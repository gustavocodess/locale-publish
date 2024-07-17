import traverse from "traverse";
import appState from '@builder.io/app-context';
import { pushBlocks, pushLocale, updateChildren } from "./locale-service";
import { duplicateDefaultValuesToLocaleValues, getLocaleFromPage } from './utils/locales';
import { addUniqueIdsInBlocks, mergeBlocks} from "./utils/blocks";
import { clearBlock, deepGet, deepSet, fastClone, getQueryLocales, localizeBlocks, localizeDataFromMaster, replaceAll, tagMasterBlockOptions } from "./plugin-helpers";
import { findIndex } from "lodash";
import { get } from "https";

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
  let masterBlocks = (JSON.parse(masterContent?.data?.blocksString)).filter((block: any) => !block?.id.includes('pixel'))
  const childrenContent = await (await fetch(`https://cdn.builder.io/api/v3/content/${modelName}/${chidrenId}?apiKey=${apiKey}&cachebust=true&includeUnpublished=true`)).json();

  const childrenLocale = childrenContent?.query.filter((query: any) => query?.property === 'locale')[0]?.value[0]
  const masterLocale = masterContent?.query.filter((query: any) => query?.property === 'locale')[0]?.value[0]

  masterBlocks = addUniqueIdsInBlocks(masterBlocks);
  await pushBlocks(masterContent?.id, modelName, masterBlocks, privateKey);

  // tagging and localizing master blocks
  let newBlocks = localizeBlocks(masterBlocks, childrenLocale, false)
  newBlocks = newBlocks.map((block: any) => tagMasterBlockOptions(block))
  
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
  const result = await updateChildren(chidrenId, privateKey, finalBlocks, modelName,
    finalDataFields, newQuery,
    childrenContent.published, childrenContent.modelId, name, true
  )

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
  const childrenContent = await (await fetch(`https://cdn.builder.io/api/v3/content/${modelName}/${chidrenId}?apiKey=${apiKey}`)).json();
  // &cachebust=true&includeUnpublished=true&cacheSeconds=1
  const masterBlocks = (JSON.parse(masterContent?.data?.blocksString)).filter((block: any) => !block?.id.includes('pixel'))
  let childrenContentBlocks = childrenContent?.data?.blocks?.filter((block: any) => !block?.id.includes('pixel'))
  const localeToPush = childrenContent?.query?.find((query: any) => query?.property === 'locale')?.value[0]

  const childrenTranslationsMap = <any>{}
  childrenContentBlocks?.forEach((block: any) => {
    traverse(block).map(function () {
      const path = this.path.join('.')
      // builder-2dd272b16b024dcbb87dee05d448858f.component.options.cards.bg-BG.2.heading.bg-BG :"local card onlyyy"
      if (path.endsWith(localeToPush)) {
        const localizedPath = replaceAll(path, '.Default', `.${localeToPush}`)
        // component.options.cards.bg-BG.2.heading.bg-BG
        const getTranslation = deepGet(block, localizedPath) // "local card onlyyy"
        const getDefaultTag = deepGet(block, replaceAll(path, `.${localeToPush}`, '.Default',))
        // avoid pushing translations that are not on the master (local cards only example)
        // apparetnly the local block once edited loses the gm_tag
        // see ctaLink on local cards
        // if (typeof getTranslation === 'object' && !getDefaultTag?.gm_tag) {
        if (
          // (typeof getTranslation === 'object' && !getDefaultTag?.gm_tag)
          // || 
         (getTranslation !== undefined
          &&  getDefaultTag === undefined)
          || (typeof getTranslation === 'object' && !getDefaultTag?.gm_tag)
          // /\ means value is local only
        ) {
          // !TODO: add to local values to restore
          // console.log('ignorei esse ', getTranslation,  localizedPath)
          return
        }
        const mapPath = block.id + '.' + localizedPath
        if (getTranslation !== undefined) {
          childrenTranslationsMap[mapPath] = getTranslation
        } else {
          childrenTranslationsMap[mapPath] = deepGet(block, path)
        }
        // childrenTranlationsMap[mapPath] = getTranslation ? getTranslation : deepGet(block, replaceAll(path, `.${localeToPush}`, '.Default'))
      }
    })
  })

  // creating final blocks first based on master content only
  let finalBlocks = [
    ...masterBlocks.map((block: any) => ({...block, meta: {...block.meta, masterId: block.id}}))
  ]
  // localizing master blocks
  finalBlocks = localizeBlocks([...finalBlocks], localeToPush, true, childrenTranslationsMap)
  // tagging master blocks options
  finalBlocks = [...finalBlocks].map((block: any) => tagMasterBlockOptions(block))



  const masterBlocksMap = <any>{}
  finalBlocks.forEach((block: any) => {
    masterBlocksMap[block.id] = block
  })

  const localValuesOnly = <any>{}
  let addedPaths = 'random-string-to-avoid-empty-string'

  // this controls which blocks exists only local and should be restored
  childrenContentBlocks?.forEach((childrenBlock: any, index: number) => {
    if (masterBlocksMap[childrenBlock.id]) {
      // block exists on master, update its content
      const indexToReplace = findIndex(finalBlocks, (block: any) => block?.id === childrenBlock?.id)
      let newBlock = {...masterBlocksMap[childrenBlock.id]}

      // blocks to be recovered (children only)
      traverse(childrenBlock).map(function () {
        const currentPath = this.path.join('.')
        const pathAbove = this.path.slice(0, -1).join('.')
        const elem = deepGet(childrenBlock, currentPath)
        if (
          !currentPath.includes('ComponentStyles')
          && pathAbove.endsWith(localeToPush)
          && elem !== undefined && !elem.gm_tag
          && typeof elem === 'object'
          && !currentPath.includes(addedPaths)
        ) {
          localValuesOnly[childrenBlock.id + '.' + currentPath] = this.node
          addedPaths = currentPath
        }
      })

      // // clear block from null content or content not on local
      // newBlock = clearBlock(newBlock, childrenContentBlocks, localeToPush)
      finalBlocks[indexToReplace] = newBlock
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

  const childMap = <any>{}
  childrenContentBlocks.forEach((block: any) => {
    childMap[block?.id] = {...block}
  })

  const finalBlocksMap = <any>{}
  finalBlocks.forEach((block: any) => {
    finalBlocksMap[block?.id] = {...block}
  })
  // apply translation if exists and if default value on master is the same
  Object.keys(childrenTranslationsMap).map((keyPath: string) => {
    const path = keyPath.split('.').slice(1).join('.') // removing block id
    const blockId = keyPath.split('.')[0]
    if (!finalBlocksMap[blockId]) {
      return
    }
    const defaultPath = replaceAll(path, `.${localeToPush}`, '.Default')
    const defaultOnMaster = deepGet(finalBlocksMap[blockId], defaultPath)
    const defaultOnChildren = deepGet(childMap[blockId], defaultPath)
    let translatedValue = childrenTranslationsMap[keyPath]

    // console.log('defaults comparison ', defaultOnMaster, defaultOnChildren, keyPath)
    if (typeof defaultOnMaster === 'string' && defaultOnMaster !== defaultOnChildren) {
      translatedValue = defaultOnMaster
    } else if (typeof defaultOnMaster === 'object') {
      const masterValue = JSON.stringify(defaultOnMaster)
      const childrenValue = JSON.stringify(defaultOnChildren)
      if (masterValue !== childrenValue) {
        translatedValue = defaultOnMaster
      }
    }
    deepSet(finalBlocksMap[blockId], path, translatedValue, true)
  })

  // apply new child blocks 
  finalBlocks = Object.values(finalBlocksMap)

  //  restore existing content in childrenOnly
  // console.log('localValuesOnly before ', localValuesOnly)
  // Object.keys(localValuesOnly).map((blockKeyPath: string) => {
  //   const blockId = blockKeyPath.split('.')[0]
  //   const keyPath = blockKeyPath.split('.').slice(1).join('.')
  //   // const newBlock = 
  //   const lastKey = keyPath.split('.').pop()
  //   console.log('keypath aqui ', keyPath, finalBlocksMap, blockId, lastKey)
  //   const isNumber = !isNaN(parseFloat(lastKey!))
  //   if (deepGet(finalBlocksMap[blockId], keyPath) && isNumber) {
  //     // it means that the value already exists on master and index is number,
  //     // need to find next index available
  //     let newIndex = Number(lastKey) + 1
  //     console.log('new index to put ', newIndex, keyPath)
  //     let newPath = keyPath.split('.').slice(0, -1).join('.') + `.${newIndex}`
  //     while (deepGet(finalBlocksMap[blockId], newPath) !== undefined) {
  //       newIndex++
  //       newPath = keyPath.split('.').slice(0, -1).join('.') + `.${newIndex}`
  //       console.log('new index, newPath', newIndex, newPath)
  //     }
  //     deepSet(finalBlocksMap[blockId], newPath, localValuesOnly[keyPath], true)
  //   } else {
  //     deepSet(finalBlocksMap[blockId], keyPath, localValuesOnly[keyPath], true)
  //   }
  // })
  finalBlocks = Object.values(finalBlocksMap)

  // on repush, data fields should not be updated, only blocks
  const finalDataFields: any = {...childrenContent?.data}
  // call write API to update the children with new blocks
  const result = await updateChildren(chidrenId, privateKey, finalBlocks, modelName,
    finalDataFields, [], childrenContent.published, childrenContent.modelId)
  return result;

}


export async function pushToLocales(localesToPublish: string[], cloneContent: any, privateKey: string, modelName: string) {
  const createdEntries: any[] = []
  const currentLocaleTargets = getQueryLocales(appState?.designerState?.editingContentModel)
  let masterBlocks = (JSON.parse(cloneContent?.data?.blocksString)?? []).map((block: any) => ({...block, meta: {...block.meta, masterId: block.id}}));

  masterBlocks = masterBlocks.map((block: any) => {
    return tagMasterBlockOptions(block)
  })
  // updating master content with gm_tags
  // await pushBlocks(cloneContent?.id, modelName, masterBlocks,
  //   published, modelId, privateKey)
  const masterData = cloneContent?.data

  masterBlocks = addUniqueIdsInBlocks(masterBlocks);
  await pushBlocks(cloneContent?.id, modelName, masterBlocks, privateKey)

  const results = localesToPublish.map(async (locale: string) => {
    let newBlocks = localizeBlocks(masterBlocks, locale, false)
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
    return result;
  })

  const success = await Promise.all(results.map(p => p.catch(e => e)))
  const validResults = success.filter(result => !(result instanceof Error));
  // console.log('validResults ', validResults)
  const newLocaleReferences = [
    ...masterData?.localeChildren?? [],
    ...createdEntries.map((item) => ({
      name: item.name,
      modelName,
      referenceId: item.id,
      target: item.target
    }))
  ]
  await updateParentWithReferences(newLocaleReferences, privateKey, modelName)
  // returns true if no errors happened on any calls
  return validResults.length === localesToPublish.length;

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