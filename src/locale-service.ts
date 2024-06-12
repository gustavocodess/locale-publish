
interface Payload {
  query?: any[];
  data: any;
}

export async function updateChildren(contentId: string, privateKey: string, newBlocks: any[], modelName: string, dataFields: any, newQuery: any[] = []) {
  // !IMPORTANT: Remove all unwanted fields from parentData
  delete dataFields.isGlobal
  delete dataFields.localeChildren
  delete dataFields.parent
  delete dataFields.isMasterLocale
  delete dataFields.masterLanguage
  delete dataFields.blocks

  const newPayload: Payload = {
    // updates the url path for the locale
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

  const res2 = await fetch(
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