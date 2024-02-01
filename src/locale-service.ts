

export async function updateChildren(contentId: string, privateKey: string, newBlocks: any[], modelName: string) {
  const res2 = await fetch(
    `https://builder.io/api/v1/write/${modelName}/${contentId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${privateKey}`
      },
      body: JSON.stringify({
        data: {
          blocks: newBlocks,
        }
      }),
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