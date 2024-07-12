import traverse from "traverse";
import appState from '@builder.io/app-context';
import { pushBlocks, pushLocale, updateChildren } from "./locale-service";
import { clearBlock, deepGet, deepSet, fastClone, getQueryLocales, localizeBlocks, localizeDataFromMaster, tagMasterBlockOptions } from "./plugin-helpers";
import { findIndex } from "lodash";
interface BuilderBlock {
  responsiveStyles: any;
  meta: any;
}

export function mergeLocalizedBlock(masterBlock: any, childrenBlock: any, locale: any) {
  // IDEA:
  // 1 - grab all already localized fields from children
  // 2 - Override children component with parent content but on localized fields, populate with
  //     the existing localized fields/translations
  const translationsMap = <any>{};
  const childrenToTraverse = {...childrenBlock}

  // Optimizing traverse
  delete childrenToTraverse.responsiveStyles
  traverse(childrenToTraverse).map(function () {
    const path = this.path.join('.') 
    if (path.endsWith('Default')) {
      if (deepGet(masterBlock, path) === deepGet(childrenBlock, path) && locale) {
        // ! THIS SHOULD ONLY UPDATE TEXTS THAT EXISTS BOTH ON GLOBAL AND LOCAL,
        // ! IF VALUE IS DIFFERENT ON GLOBAL VS LOCAL THEN SHOULD REQUIRE A NEW TRANSLATION
        translationsMap[path] = {
          [locale]: deepGet(childrenBlock, path.replace('.Default', `.${locale}`)),
        }
      } else if (deepGet(masterBlock, path) && deepGet(childrenBlock, path)) {
        // !IMPORTANT: it means the value exists but its different from the global, so it should require a new translation
        translationsMap[path] = {
          [locale]: deepGet(masterBlock, path),
          Default: deepGet(masterBlock, path),
        }
      }
    }

    Object.keys(translationsMap).map((keyPath: string) => {
      const newValue = {
        ...deepGet(childrenBlock, keyPath.replace('.Default', '')),
        ...translationsMap[keyPath],
      }
      deepSet(childrenBlock, keyPath.replace('.Default', ''), newValue, false)
    })
  })
  return childrenBlock

}

export async function forcePushLocale(chidrenId: string, privateKey: string, apiKey: string, modelName: string) {
  const masterContent = fastClone(appState?.designerState?.editingContentModel)
  const masterBlocks = (JSON.parse(masterContent?.data?.blocksString)).filter((block: any) => !block?.id.includes('pixel'))
  const childrenContent = await (await fetch(`https://cdn.builder.io/api/v3/content/${modelName}/${chidrenId}?apiKey=${apiKey}&cachebust=true&includeUnpublished=true`)).json();

  const childrenLocale = childrenContent?.query.filter((query: any) => query?.property === 'locale')[0]?.value[0]
  const masterLocale = masterContent?.query.filter((query: any) => query?.property === 'locale')[0]?.value[0]
  const newBlocks = localizeBlocks(masterBlocks, childrenLocale, false)
  // creating final blocks based on master content only
  const finalBlocks = [...newBlocks.map((block: any) => ({...block, meta: {...block.meta, masterId: block.id}}))]
  const finalDataFields: any = localizeDataFromMaster(masterContent.data, childrenLocale)

  const queryLocale = childrenContent?.query?.find((query: any) => query?.property === 'locale')
  const newQuery = [
    ...masterContent?.query.filter((query: any) => query?.property !== 'locale'),
    {
      ...queryLocale,
    }
  ]
  
  const name = `local from ${masterLocale} | ${masterContent.name} - ${childrenLocale}`
  // call write API to update the children with new blocks
  const result = await updateChildren(chidrenId, privateKey, finalBlocks, modelName, finalDataFields, newQuery, name)
  const localeChildrenIndex = masterContent?.data?.localeChildren.findIndex((item: any) => item?.referenceId === chidrenId)
  const localeChildren = masterContent?.data?.localeChildren

  if (localeChildren[localeChildrenIndex].name !== name) {
    // remove existing locale children with same name
    const newLocale = {
      ...localeChildren[localeChildrenIndex],
      name,
    }
    const newLocales = [
      ...masterContent?.data?.localeChildren.slice(0, localeChildrenIndex),
      newLocale,
      ...masterContent?.data?.localeChildren.slice(localeChildrenIndex + 1),
    ]

    const res = await updateParentWithReferences(newLocales, privateKey, modelName)
  }


  // const res = await 
  return result;
}

export async function repushSingleLocale(chidrenId: string, privateKey: string, apiKey: string, modelName: string) {
  const masterContent = fastClone(appState?.designerState?.editingContentModel)
  const childrenContent = await (await fetch(`https://cdn.builder.io/api/v3/content/${modelName}/${chidrenId}?apiKey=${apiKey}&cachebust=true&includeUnpublished=true&cacheSeconds=1`)).json();
  // ?cachebust=true&includeUnpublished=true&cacheSeconds=1
  const masterBlocks = (JSON.parse(masterContent?.data?.blocksString)).filter((block: any) => !block?.id.includes('pixel'))
  let childrenContentBlocks = childrenContent?.data?.blocks?.filter((block: any) => !block?.id.includes('pixel'))
  const localeToPush = childrenContent?.query?.find((query: any) => query?.property === 'locale')?.value[0]

  const childrenTranlationsMap = <any>{}
  childrenContentBlocks?.forEach((block: any) => {
    traverse(block).map(function () {
      const defaultPath = this.path.join('.')
      // .replaceAll('.Default', '').replaceAll(`.${localeToPush}`, '')
      // if (path.endsWith('Default') && path.includes('text')) {
      if (defaultPath.endsWith('Default')) {
        const localizedPath = defaultPath.replaceAll('.Default', `.${localeToPush}`)
        // const getTranslation = deepGet(block, path.replace('Default', localeToPush))
        const getTranslation = deepGet(block, localizedPath)
        const mapPath = block.id + '.' + localizedPath
        childrenTranlationsMap[mapPath] = getTranslation ? getTranslation : deepGet(block, defaultPath)
      }
    })
  })

  // creating final blocks first based on master content only
  let finalBlocks = [
    ...masterBlocks.map((block: any) => ({...block, meta: {...block.meta, masterId: block.id}}))
  ]
  // localizing master blocks
  finalBlocks = localizeBlocks([...finalBlocks], localeToPush, true)
  // tagging master blocks options
  finalBlocks = finalBlocks.map((block: any) => tagMasterBlockOptions(block))


  const masterBlocksMap = <any>{}
  finalBlocks.forEach((block: any) => {
    masterBlocksMap[block.id] = block
  })

  const entireMasterPaths = <any>{}
  masterBlocks.forEach((block: any) => {
    traverse(block).map(function () {
      const path = this.path.join('.').replace(/\.Default/g, '').replace(new RegExp(`\\.${localeToPush}`, 'g'), '')
      entireMasterPaths[block.id + '.' + path] = true
    })
  })

  const localValuesOnly = <any>{}
  let addedPaths = 'random-string-to-avoid-empty-string'


  // this controls which blocks exists only local and should be restored
  childrenContentBlocks?.forEach((childrenBlock: any, index: number) => {
    if (masterBlocksMap[childrenBlock.id]) {
      // block exists on master, update its content
      const indexToReplace = findIndex(finalBlocks, (block: any) => block?.id === childrenBlock?.id)
      const newBlock = {...masterBlocksMap[childrenBlock.id]}

      // blocks to be recovered (children only)
      traverse(childrenBlock).map(function () {
        const currentPath = this.path.join('.')
        const pathAbove = this.path.slice(0, -1).join('.')
        if (
          !currentPath.includes('ComponentStyles')
          && pathAbove.endsWith(localeToPush)
          && !this.node?.gm_tag
          && typeof this.node === 'object'
          && !currentPath.includes(addedPaths)
        ) {
          localValuesOnly[currentPath] = this.node
          addedPaths = currentPath
        }
      })

      console.log('new block before ', newBlock)


      // apply translation if exists and if default value on master is the same
      traverse(newBlock).map(function () {
        const path = this.path.join('.')
        const mapPath = childrenBlock.id + '.' + path.replaceAll('.Default', `.${localeToPush}`)

        if (path.endsWith('Default') && childrenTranlationsMap[mapPath]) {
          const defaultOnMaster = deepGet(masterBlocksMap[childrenBlock.id], path)
          const defaultOnChildren = deepGet(childrenBlock, path)
          let translatedValue = childrenTranlationsMap[mapPath]
          // logic added because for nested columsn the final value is not a string
          if (typeof defaultOnMaster === 'string' && defaultOnMaster !== defaultOnChildren) {
            translatedValue = defaultOnMaster
          } else if (typeof defaultOnMaster === 'object') {
            const masterValue = JSON.stringify(defaultOnMaster)
            const childrenValue = JSON.stringify(defaultOnChildren)
            if (masterValue !== childrenValue) {
              translatedValue = defaultOnMaster
            }
          }
          deepSet(newBlock, mapPath.split('.').slice(1).join('.'), translatedValue, true)
        }
      })

      console.log('new block after ', newBlock)

      // restore existing content in childrenOnly
      Object.keys(localValuesOnly).map((keyPath: string) => {
        const lastKey = keyPath.split('.').pop()
        if (deepGet(newBlock, keyPath) && typeof Number(lastKey) === 'number') {
          // it means that the value already exists on master and index is number,
          // need to find next index available
          let newIndex = Number(lastKey) + 1
          let newPath = keyPath.split('.').slice(0, -1).join('.') + `.${newIndex}`
          while (deepGet(newBlock, newPath)) {
            newIndex++
            newPath = keyPath.split('.').slice(0, -1).join('.') + `.${newIndex}`
          }
          deepSet(newBlock, newPath, localValuesOnly[keyPath], true)
        } else {
          deepSet(newBlock, keyPath, localValuesOnly[keyPath], true)
        }
      })
      // added clear block function because of null values
      // after deleting existing slides/cards on previous positions
      finalBlocks[indexToReplace] = clearBlock(newBlock)
    } else {
      // block doesnt exist on master, so
      if (!childrenBlock?.meta?.masterId) {
        // meands the block is new, so push to final blocks
        const newBlock = {...childrenBlock}
        finalBlocks = [...finalBlocks.slice(0, index), newBlock, ...finalBlocks.slice(index)]
      } else {
        // do nothing, block was deleted on master
      }
    }
  })

  // console.log('localValuesOnly to restore', localValuesOnly)

  // on repush, data fields should not be updated, only blocks
  const finalDataFields: any = {...childrenContent?.data}
  // call write API to update the children with new blocks
  const result = await updateChildren(chidrenId, privateKey, finalBlocks, modelName, finalDataFields)
  return result;

}

// !IMPORTANT: DEPRECATED
export async function updateSelectedElements(chidrenId: string, masterClone: any, privateKey: string, apiKey: string, modelName: string, elementToUpdate: any) {
  const childrenContent = await (await fetch(`https://cdn.builder.io/api/v3/content/${modelName}/${chidrenId}?apiKey=${apiKey}&cachebust=true&includeUnpublished=true`)).json();

  const childrenContentBlocks = (childrenContent?.data?.blocks?? []).filter((block: any) => !block?.id.includes('pixel'))
  const masterBlocks = (JSON.parse(masterClone?.data?.blocksString)).filter((block: any) => !block?.id.includes('pixel'))

  const childrenMap = <any>{}
  childrenContentBlocks.forEach((block: any) => {
    childrenMap[block.id] =  true
  })

  let elementToAdd = fastClone(elementToUpdate)
  elementToAdd = {...elementToAdd, meta: { ...elementToAdd.meta, masterId: masterClone?.id}}

  if (childrenMap[elementToUpdate?.id] || childrenMap[elementToUpdate?.meta?.previousId]) {
    // it means the element already exists on children, so update content
    let finalBlocks = [...childrenContentBlocks.map((block: any) => (block))]
    const elementIndex = childrenContentBlocks.findIndex((block: any) => block?.meta?.previousId === elementToUpdate?.id || block.id === elementToUpdate?.id)
    // TODO: instead of updating whole element, preserve existing translations on existing children (if exist)
    finalBlocks[elementIndex] = elementToAdd
    return (await updateChildren(chidrenId, privateKey, finalBlocks, modelName, masterClone?.data))?.ok
  }

  // ELSE: IN CASE NEW ELEMENT DOESNT EXIST ON CHILDREN CONTENT
  // index to insert new element on children content
  const anchorIndex = masterBlocks.findIndex((block: any) => block?.meta?.previousId === elementToUpdate?.id || block.id === elementToUpdate?.id)

  // creating final blocks first based on children content only
  let finalBlocks = [...childrenContentBlocks]

  finalBlocks = [
    ...finalBlocks.slice(0, anchorIndex),
    elementToAdd,
    ...finalBlocks.slice(anchorIndex),
  ]
  return (await updateChildren(chidrenId, privateKey, finalBlocks, modelName, masterClone?.data))?.ok
}

export async function pushToLocales(localesToPublish: string[], cloneContent: any, privateKey: string, modelName: string) {
  const createdEntries: any[] = []
  const currentLocaleTargets = getQueryLocales(appState?.designerState?.editingContentModel)
  let masterBlocks = (JSON.parse(cloneContent?.data?.blocksString)?? []).map((block: any) => ({...block, meta: {...block.meta, masterId: block.id}}));

  masterBlocks = masterBlocks.map((block: any) => {
    return tagMasterBlockOptions(block)
  })
  // updating master content with gm_tags
  await pushBlocks(cloneContent?.id, modelName, masterBlocks, privateKey)

  const results = localesToPublish.map(async (locale: string) => {
    let newBlocks = localizeBlocks(masterBlocks, locale, false)

    const masterData = cloneContent?.data
    const newData = localizeDataFromMaster(masterData, locale)
    const localeTarget = {
      "@type": "@builder.io/core:Query",
      "property": "locale",
      "value": [locale],
      "operator": "is"
    }

    const newContent = {
      ...cloneContent,
      data: {
        // ...cloneContent.data,
        ...newData,
        blocks: newBlocks,
        // adding parent for reference from Global Master
        parent: {
          "@type": "@builder.io/core:Reference",
          "model": modelName,
          "id": cloneContent.id,
        },
        isGlobal: false,
      },
      name: `local from ${currentLocaleTargets.join('-')} | ${cloneContent.name} - ${locale}`,
      published: 'draft',
      query: [
        //remove locales from global in case there is any: should not go to local page
        ...cloneContent.query.filter((query: any) => query?.property !== 'locale'),
        {
          ...localeTarget,
        }
      ]
    }
    // TODO: REST
    delete newContent.id;

    const result = await pushLocale(newContent, privateKey, modelName);
    const entryCreated = await result.json();

    createdEntries.push({id: entryCreated.id, target: localeTarget, name: entryCreated.name})

    // last iteraction, updates parent with children references
    if (createdEntries.length === localesToPublish.length) {
      const newLocaleReferences = [
        ...masterData?.localeChildren?? [],
        ...createdEntries.map((item) => ({
          name: item.name,
          // reference: {
          //   "@type": "@builder.io/core:Reference",
          //   "model": modelName,
          //   "id": item.id,
          // },
          // reference: {
          //   id: item.id,
          // },
          modelName,
          referenceId: item.id,
          target: item.target
        }))
      ]
      await updateParentWithReferences(newLocaleReferences, privateKey, modelName)
    }
    return result;
  })

  const success = await Promise.all(results)
  // returns true if no errors happened on any calls
  return !(success).filter((response) => response.status !== 200).length

}

export async function updateParentWithReferences(newLocaleReferences: any[], privateKey: string, modelName: string) {
  // UPDATE current content with children references
  const masterContent = fastClone(appState?.designerState?.editingContentModel)
  // const liveParentBlocks = JSON.parse(masterContent?.data?.blocksString)
  return await fetch(
    `https://builder.io/api/v1/write/${modelName}/${masterContent.id}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${privateKey}`
      },
      body: JSON.stringify({
        data: {
          localeChildren: [
            ...newLocaleReferences,
          ],
          // had to add to draft because once use write API, the editor imediatlly refreshes to get
          // latest content with the latest published, which is not what we want 
          // blocks: liveParentBlocks,
        },
        // published: 'draft',
      }),
    }
  ).then(res => res);
}


export const DEFAULT_LOCALE_VALUE = 'Default';

export const getAllowedLocalesForUserRole = () => {
  const userRole = appState.user.roleInfo;

  if (userRole?.locales?.canEditAllLocales) {
    return [DEFAULT_LOCALE_VALUE, ...getLocaleOptions()];
  } else if (userRole?.locales?.allowedLocalesEditList?.length) {
    return [...userRole?.locales?.allowedLocalesEditList];
  }

  return [];
};

export const getLocaleOptions = (): string[] => [
  ...(appState.user.organization?.value.customTargetingAttributes.get('locale')?.get('enum') || []),
];
const LOCALE_PERMISSIONS_LAUNCH_DARKLY_FLAG = 'locale-permissions';
export function isLocalePermissionsFeatureEnabled(user: any) {
  return (
    user.features.has('customTargeting') &&
    appState.user.isEnterprise &&
    appState.hasFeatureFlag(LOCALE_PERMISSIONS_LAUNCH_DARKLY_FLAG)
  );
}

export function hasAccessToLocale({ role, locale }: { role: any; locale: string }) {
  // if locale permissions feature itself is disabled for this org,
  // then allow everything as before
  if (!isLocalePermissionsFeatureEnabled(appState.user)) {
    return true;
  }

  // a fail safe, in case the new locales property is
  // NOT available on 'role' mobx model, then allow as before
  if (role && !role.locales) {
    return true;
  }

  return (
    role && (role.locales.canEditAllLocales || role.locales.allowedLocalesEditList.includes(locale))
  );
}

export const getLocalesForRole = (): string[] => {
  return [DEFAULT_LOCALE_VALUE].concat(getLocaleOptions()).filter(locale =>
    hasAccessToLocale({
      role: appState.user.roleInfo,
      locale,
    })
  );
};

export const getLocaleOptionsForRole = () =>
  getLocalesForRole().map((locale: string) => ({
    label: locale,
    value: locale,
  }));

export function countWords() {
  const stringsList: string[] = []
  const stringsMap: Map<string, string> = new Map<string,string>()
  const currentContent = fastClone(appState?.designerState?.editingContentModel)
  const blocks = (JSON.parse(currentContent?.data?.blocksString)).filter((block: any) => !block?.id.includes('pixel'))

  const locale = appState.designerState.activeLocale
  blocks?.forEach((block: any) => {
    traverse(block).map(function () {
      const path = this.path.join('.')
      const value = deepGet(block, path)
      const localizedValue = deepGet(block, path.replace('Default', locale))
      if (path.endsWith('.Default')
        && (path.includes('title') || path.includes('text'))
        && value && typeof value === 'string') {
        stringsMap.set(block.id + '.' + path, localizedValue)
        stringsList.push(localizedValue)
      } else if (path.endsWith('text') && path.includes(locale) && value && typeof value === 'string') {
        stringsMap.set(block.id + '.' + path, localizedValue)
        stringsList.push(localizedValue)
      } else if (path.toLowerCase().endsWith('text') && !path.includes('.Default') && value && typeof value === 'string') {
        stringsMap.set(block.id + '.' + path, this.node)
        stringsList.push(this.node)
      } 
    })
  })
  const wordsCount = stringsList.join(' ').split(' ').length
  appState.snackBar.show(`Estimated words on content: ${wordsCount}.`);
}