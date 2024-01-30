

export async function updateChildren(contentId: string, privateKey: string, newBlocks: any[]) {
  const res2 = await fetch(
    `https://builder.io/api/v1/write/page/${contentId}`,
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

export async function updateParent(contentId: string, privateKey: string) {
  // ...
  const res2 = await fetch(
    `https://builder.io/api/v1/write/page/${contentId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${privateKey}`
      },
      body: JSON.stringify({
        data: {
          deletedIds: [],
          addedIds: [],
        }
      }),
    }
  ).then(res => res);
  return res2
}

export async function pushLocale(newContent: any, privateKey: string) {
  const result = await fetch(
    `https://builder.io/api/v1/write/page`,
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