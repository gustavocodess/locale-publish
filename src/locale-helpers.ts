import traverse from "traverse";
import appState from '@builder.io/app-context';
import { pushLocale, updateChildren } from "./locale-service";
import { deepGet, fastClone, getQueryLocales } from "./plugin-helpers";
import { findIndex } from "lodash";
import { deepSet } from './deep-set';


export function mergeLocalizedBlock(masterBlock: any, childrenBlock: any, locale: any) {
  // IDEA:
  // 1 - grab all already localized fields from children
  // 2 - Override children component with parent content but on localized fields, populate with
  //     the existing localized fields/translations
  const translationsMap = <any>{};
  const childrenToTraverse = {...childrenBlock}

  // Optimizing traverse
  delete childrenToTraverse.responsiveStyles
  // console.log('childrenToTraverse ', childrenToTraverse)
  traverse(childrenToTraverse).map(function () {
    const path = this.path.join('.') 
    if (path.endsWith('Default')) {
      console.log('master default ', deepGet(masterBlock, path))
      console.log('chhildren default ', deepGet(childrenBlock, path))
      console.log('path path ', path)
      if (deepGet(masterBlock, path) === deepGet(childrenBlock, path) && locale) {
        // ! THIS SHOULD ONLY UPDATE TEXTS THAT EXISTS BOTH ON GLOBAL AND LOCAL,
        // ! IF VALUE IS DIFFERENT ON GLOBAL VS LOCAL THEN SHOULD REQUIRE A NEW TRANSLATION
        translationsMap[path] = {
          [locale]: deepGet(childrenBlock, path.replace('.Default', `.${locale}`)),
        }
      } else if (deepGet(masterBlock, path) && deepGet(childrenBlock, path)) {
        // !IMPORTANT: it means the value exists but its different from the global, so it should require a new translation
        // console.log('SETANDO NULO ', path)
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
  // creating final blocks based on master content only
  let finalBlocks = [...masterBlocks.map((block: any) => ({...block, meta: {...block.meta, masterId: block.id}}))]
  // return

  const queryLocale = childrenContent?.query?.find((query: any) => query?.property === 'locale')
  const newQuery = [
    // @ts-ignore next-line
    ...masterContent?.query.filter((query: any) => query?.property !== 'locale'),
    {
      ...queryLocale,
    }
  ]
  // call write API to update the children with new blocks
  const result = await updateChildren(chidrenId, privateKey, finalBlocks, modelName, masterContent?.data, newQuery)
  return result;
}

export async function updateSingleLocale(chidrenId: string, parentId: string, privateKey: string, apiKey: string, modelName: string) {
  const masterContent = fastClone(appState?.designerState?.editingContentModel)
  const childrenContent = await (await fetch(`https://cdn.builder.io/api/v3/content/${modelName}/${chidrenId}?apiKey=${apiKey}&cachebust=true&includeUnpublished=true`)).json();
  
  const masterBlocks = (JSON.parse(masterContent?.data?.blocksString)).filter((block: any) => !block?.id.includes('pixel'))
  let childrenContentBlocks = childrenContent?.data?.blocks?.filter((block: any) => !block?.id.includes('pixel'))

  const masterMap: any = {}
  masterBlocks?.forEach((block: any) => {
    masterMap[block.id] = block
  })

  const queryLocale = childrenContent?.query?.find((query: any) => query?.property === 'locale')

  // verify blocks that should not erase translation
  childrenContentBlocks = childrenContentBlocks.map((block: any) => {
    // TODO: revert to repush logic
  
    if (masterMap[block?.id]) {
      const newBlock = mergeLocalizedBlock(masterMap[block?.id], block, queryLocale?.value[0])
      return newBlock
    }
    return block;
  })
  // creating final blocks first based on master content only
  let finalBlocks = [...masterBlocks.map((block: any) => ({...block, meta: {...block.meta, masterId: block.id}}))]

  childrenContentBlocks?.forEach((childrenBlock: any, index: number) => {
    if (masterMap[childrenBlock.id]) {
      //  significa que o bloco existe no master, entao ja foi atualizado
      // !IMPORTANT: switch to new block with translations
      const indexToReplace = findIndex(finalBlocks, (block: any) => block.id === childrenBlock.id)
      finalBlocks[indexToReplace] = childrenBlock
    } else if (!masterMap[childrenBlock.id] && !childrenBlock?.meta?.masterId) {
    // significa que o bloco nao existe na master e nao veio da master antiga
    finalBlocks = [...finalBlocks.slice(0, index), childrenBlock, ...finalBlocks.slice(index)]
    }
  })
  // merge data fields (keep translation)
  const finalDataFields: any = {...masterContent?.data}
  Object.keys(masterContent?.data).map((key: string) => {
    if (
      masterContent?.data[key]?.['@type'] === '@builder.io/core:LocalizedValue' &&
      childrenContent?.data[key]
    ) {
      if (masterContent?.data[key]?.Default === childrenContent?.data[key]?.Default) {
        finalDataFields[key] = childrenContent?.data[key]
      }
      // else {
        // DO NOTHING, DATA FIELD WILL RECEIVE MASTER CONTENT AND REQUIRES NEW TRANSLATION
      // }
    }
  })

  // call write API to update the children with new blocks
  const result = await updateChildren(chidrenId, privateKey, finalBlocks, modelName, finalDataFields)
  return result;
}


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
    // console.log('already existss ...', finalBlocks)
    return (await updateChildren(chidrenId, privateKey, finalBlocks, modelName, masterClone?.data))?.ok
  }

  // ELSE: IN CASE NEW ELEMENT DOESNT EXIST ON CHILDREN CONTENT
  // index to insert new element on children content
  const anchorIndex = masterBlocks.findIndex((block: any) => block?.meta?.previousId === elementToUpdate?.id || block.id === elementToUpdate?.id)

  // creating final blocks first based on children content only
  let finalBlocks = [...childrenContentBlocks]
  // console.log('elementToUpdate ', elementToAdd )

  finalBlocks = [
    ...finalBlocks.slice(0, anchorIndex),
    elementToAdd,
    ...finalBlocks.slice(anchorIndex),
  ]
  // console.log('final blocks aqui ', finalBlocks)

  return (await updateChildren(chidrenId, privateKey, finalBlocks, modelName, masterClone?.data))?.ok
}

export async function pushToLocales(localesToPublish: string[], cloneContent: any, privateKey: string, modelName: string) {

  const newBlocks = (JSON.parse(cloneContent?.data?.blocksString)?? []).map((block: any) => ({...block, meta: {...block.meta, masterId: block.id}}));
  const createdEntries: any[] = []
  const currentLocaleTargets = getQueryLocales(appState?.designerState?.editingContentModel)

  const results = localesToPublish.map(async (locale: string) => {
    const localeTarget = {
      "@type": "@builder.io/core:Query",
      "property": "locale",
      "value": [locale],
      "operator": "is"
    }

    const newContent = {
      ...cloneContent,
      data: {
        ...cloneContent.data,
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
    delete newContent.id;

    const result = await pushLocale(newContent, privateKey, modelName);
    const entryCreated = await result.json();
    // console.log('entries created', entryCreated.id)

    createdEntries.push({id: entryCreated.id, target: localeTarget, name: entryCreated.name})

    // last iteraction, updates parent with children references
    if (createdEntries.length === localesToPublish.length) {
      const newLocaleReferences = [
        ...createdEntries.map((item) => ({
          name: item.name,
          reference: {
            "@type": "@builder.io/core:Reference",
            "model": modelName,
            "id": item.id,
          },
          target: item.target
        }))
      ]
      const resUpdatedParent = await updateParentWithReferences(cloneContent, newLocaleReferences, privateKey, modelName)
      // console.log('res parent ', resUpdatedParent.status)
    }
    return result;
  })

  const success = await Promise.all(results)
  // returns true if no errors happened on any calls
  return !(success).filter((response) => response.status !== 200).length

}

export async function updateParentWithReferences(parentContent: any, newLocaleReferences: any[], privateKey: string, modelName: string) {
  // UPDATE current content with children references
  const liveParentDraft = fastClone(appState?.designerState?.editingContentModel)
  const liveParentBlocks = JSON.parse(liveParentDraft?.data?.blocksString)
  return await fetch(
    `https://builder.io/api/v1/write/${modelName}/${parentContent.id}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${privateKey}`
      },
      body: JSON.stringify({
        data: {
          localeChildren: [
            ...parentContent?.data?.localeChildren?? [],
            ...newLocaleReferences,
          ],
          // had to add to draft because once use write API, the editor imediatlly refreshes to get
          // latest content with the latest published, which is not what we want 
          blocks: liveParentBlocks,
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