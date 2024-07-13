
interface Payload {
  query?: any[];
  data: any;
  name?: string;
  // modelId: string;
  // published: string;
  // id: string;
}

export async function updateChildren(
  contentId: string, privateKey: string,
  newBlocks: any[], modelName: string, dataFields: any,
  newQuery: any[] = [],
  published: string,
  modelId: string,
  newName?: string

) {
  // !IMPORTANT: Remove all unwanted fields from parentData
  delete dataFields.isGlobal
  delete dataFields.localeChildren
  delete dataFields.parent
  delete dataFields.isMasterLocale
  delete dataFields.masterLanguage
  delete dataFields.blocks

  const newPayload: Payload = {
    // updates the url path for the locale
    // ! used for not live update
    // modelId: modelId,
    // published: published,
    // id: contentId,
    name: newName,
    query: [
      ...newQuery,
    ],
    data: {
      ...dataFields,
      blocks: newBlocks,
    }
  }
  if (!newQuery.length) {
    delete newPayload.query
  }
  if (!newName) {
    delete newPayload.name
  }

  const res2 = await fetch(
    // ?autoSaveOnly=true
    `https://builder.io/api/v1/write/${modelName}/${contentId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${privateKey}`
      },
      body: JSON.stringify(newPayload),
    }
  ).then(res => res);
  return res2
}

export async function pushLocale(newContent: any, privateKey: string, modelName: string) {
  const result = await fetch(
    `https://builder.io/api/v1/write/${modelName}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${privateKey}`
      },
      body: JSON.stringify(newContent),
    }
  ).then(res => res);
  return result;
}

export async function createDuplicate(newContent: any, privateKey: string, modelName: string) {
  const result = await fetch(
    `https://builder.io/api/v1/write/${modelName}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${privateKey}`
      },
      body: JSON.stringify(newContent),
    }
  ).then(res => res);
  return result;
}

export async function pushBlocks(entryId: string, modelName: string, blocks: any[], published: string, modelId: string, privateKey: string) {
  // saving gm_tag
  const payload = {
    // published: published,
    // modelId: modelId,
    // id: entryId,
    data: {
      blocks: blocks,
    }
  }
  const result = await fetch(
    `https://builder.io/api/v1/write/${modelName}/${entryId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${privateKey}`
      },
      body: JSON.stringify(payload),
    }
  ).then(res => res);
  return result;
}