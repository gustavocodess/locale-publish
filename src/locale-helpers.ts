import { pushLocale, updateChildren } from "./locale-service";

export async function updateSingleLocale(chidrenId: string, parentId: string, privateKey: string, apiKey: string, modelName: string) {
  const masterContent = await (await fetch(`https://cdn.builder.io/api/v3/content/${modelName}/${parentId}?apiKey=${apiKey}&cachebust=true`)).json();
  const childrenContent = await (await fetch(`https://cdn.builder.io/api/v3/content/${modelName}/${chidrenId}?apiKey=${apiKey}&cachebust=true&includeUnpublished=true`)).json();

  const childrenContentBlocks = (childrenContent?.data?.blocks?? []).filter((block: any) => !block?.id.includes('pixel'))
  const masterBlocks = (masterContent?.data?.blocks?? []).filter((block: any) => !block?.id.includes('pixel'))

  const masterMap: any = {}
  masterBlocks?.forEach((block: any) => {
    masterMap[block.id] = true
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
  // call write API to update the children with new blocks
  const result = await updateChildren(chidrenId, privateKey, finalBlocks, modelName)
  return result;
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
      console.log('res parent ', resUpdatedParent.status)
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