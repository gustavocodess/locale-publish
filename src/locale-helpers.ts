import traverse from "traverse";
import { pushLocale, updateChildren } from "./locale-service";
import { fastClone } from "./plugin-helpers";

export function mergeLocalizedBlock(masterBlock: any, childrenBlock: any, locale: any) {
  // IDEA:
  // 1 - grab all already localized fields from children
  // 2 - Override children component with parent content but on localized fields, populate with
  //     the existing localized fields/translations
  const translationsMap = <any>{};
  const childrenToTraverse = {...childrenBlock}

  // Optimizing traverse
  delete childrenToTraverse.responsiveStyles
  traverse(childrenToTraverse).map(function (value: any) {
    const path = this.path.join('.')
    if (path.endsWith('Default')) {
      if (masterBlock[`${path}`] === childrenBlock[`${path}`] && locale) {
        // TODO: IMPORTANT: THIS SHOULD ONLY UPDATE TEXTS THAT EXISTS BOTH ON GLOBAL AND LOCAL,
        // TODO: IF VALUE IS DIFFERENT ON GLOBAL VS LOCAL THEN SHOULD REQUIRE A NEW TRANSLATION
        translationsMap[path] = {
          [locale]: childrenBlock[`${path}`]
        }
      }
    }

    // now we have translations on translationMap
    // console.log('path content value ', value)
    // console.log('context.path ', this.path)

    Object.keys(translationsMap).map((keyPath: string) => {
      childrenBlock[keyPath] = {
        ...childrenBlock[keyPath],
        [locale]: translationsMap[keyPath]
      }
    })
    // console.log('new children block ', childrenBlock)
    return childrenBlock
  })

}

export async function updateSingleLocale(chidrenId: string, parentId: string, privateKey: string, apiKey: string, modelName: string) {
  const masterContent = await (await fetch(`https://cdn.builder.io/api/v3/content/${modelName}/${parentId}?apiKey=${apiKey}&cachebust=true`)).json();
  const childrenContent = await (await fetch(`https://cdn.builder.io/api/v3/content/${modelName}/${chidrenId}?apiKey=${apiKey}&cachebust=true&includeUnpublished=true`)).json();

  let childrenContentBlocks = (childrenContent?.data?.blocks?? []).filter((block: any) => !block?.id.includes('pixel'))
  const masterBlocks = (masterContent?.data?.blocks?? []).filter((block: any) => !block?.id.includes('pixel'))

  const masterMap: any = {}
  masterBlocks?.forEach((block: any) => {
    masterMap[block.id] = block
  })

  const queryLocale = childrenContent?.query?.find((query: any) => query?.property === 'locale')

  // verify blocks that should not erase translation
  childrenContentBlocks = childrenContentBlocks.map((block: any) => {
    if (masterMap[block?.id]) {
      return mergeLocalizedBlock(masterMap[block?.id], block, queryLocale?.value[0])
    }
    return block;
  })

  // creating final blocks first based on master content only
  let finalBlocks = [...masterBlocks.map((block: any) => ({...block, meta: {...block.meta, masterId: block.id}}))]

  childrenContentBlocks?.forEach((childrenBlock: any, index: number) => {
    if (masterMap[childrenBlock.id]) {
      //  significa que o bloco existe no master, entao ja foi atualizado
      // do nothing
    } else if (!masterMap[childrenBlock.id] && !childrenBlock?.meta?.masterId) {
    // significa que o bloco nao existe na master e nao veio da master antiga
    finalBlocks = [...finalBlocks.slice(0, index), childrenBlock, ...finalBlocks.slice(index)]
    }
  })

  // console.log('new final blocks ', finalBlocks)
  return

  // call write API to update the children with new blocks
  // const result = await updateChildren(chidrenId, privateKey, finalBlocks, modelName)
  // return result;
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

  // console.log('meta meta elementToAdd', elementToAdd)

  if (childrenMap[elementToUpdate?.id] || childrenMap[elementToUpdate?.meta?.previousId]) {
    // console.log('already existss ...')
    // it means the element already exists on children, so update content
    let finalBlocks = [...childrenContentBlocks.map((block: any) => (block))]
    const elementIndex = childrenContentBlocks.findIndex((block: any) => block?.meta?.previousId === elementToUpdate?.id || block.id === elementToUpdate?.id)
    // TODO: instead of updating whole element, preserve existing translations on existing children (if exist)
    finalBlocks[elementIndex] = elementToAdd
    // console.log('already existss ...', finalBlocks)
    return (await updateChildren(chidrenId, privateKey, finalBlocks, modelName))?.ok
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

  return (await updateChildren(chidrenId, privateKey, finalBlocks, modelName))?.ok
}

export async function pushToLocales(localesToPublish: string[], cloneContent: any, privateKey: string, modelName: string) {

  const newBlocks = (JSON.parse(cloneContent?.data?.blocksString)?? []).map((block: any) => ({...block, meta: {...block.meta, masterId: block.id}}));
  const createdEntries: any[] = []

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
        title: `${cloneContent.name} - ${locale}`,
        // adding parent for reference from Global Master
        parent: {
          "@type": "@builder.io/core:Reference",
          "model": modelName,
          "id": cloneContent.id,
        },
        isGlobal: false,
      },
      name: `local for ${cloneContent.name} - ${locale}`,
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
          ]
        }
      }),
    }
  ).then(res => res);
}