import React from 'react';
import {
  Button,
} from '@material-ui/core';
import appState from '@builder.io/app-context';
import { updateSingleLocale, forcePushLocale } from './locale-helpers';
import LocaleItem from './locale-item';
import { fastClone } from './plugin-helpers';

interface Props {
  privateKey: string;
}

const LocalesTab = (props: Props) => {
  const { privateKey } = props
  const currentContent = fastClone(appState?.designerState?.editingContentModel)
  const localeChildren = currentContent?.data?.localeChildren?? []
  const parentId = currentContent?.id
  const modelName = appState?.designerState?.editingModel?.name

  const apiKey = fastClone(appState?.user?.apiKey)

  // TODO: check for alternatives in case is not a global page, remove this tab
  //  in theory it will never get registered
  if (!currentContent?.data?.isGlobal) {
    return null
  }

  // const handleRefresh = async () => {
  //   const chidrenId = '4cc33b2a723f46ed964092d9a5f840ce'
  //   const masterContent = await (await fetch(`https://cdn.builder.io/api/v3/content/page/${parentId}?apiKey=9f9421c6a1ba44f6a3e0e4d7e47f4e5a&cachebust=true`)).json();
  //   const childrenContent = await (await fetch(`https://cdn.builder.io/api/v3/content/page/${chidrenId}?apiKey=9f9421c6a1ba44f6a3e0e4d7e47f4e5a&cachebust=true&includeUnpublished=true`)).json();
  //   console.log('children content ',  childrenContent?.data)

  //   const childrenContentBlocks = (childrenContent?.data?.blocks?? []).filter((block: any) => !block?.id.includes('pixel'))
  //   console.log('children content blocks ',  childrenContentBlocks);
  //   const masterBlocks = (masterContent?.data?.blocks?? []).filter((block: any) => !block?.id.includes('pixel'))
  //   console.log('master blocks ', masterBlocks);
  // }

  const handleForcePush = async (childrenId: string) => {

    await appState.globalState.showGlobalBlockingLoading(`Pushing changes...`);
    const result = await forcePushLocale(childrenId, currentContent, privateKey, modelName)
    if (result.status === 200) {
      appState?.snackBar.show(`Suceessfully updated ${childrenId} with global master blocks.`);
    }
    await appState.globalState.hideGlobalBlockingLoading();
  };

  const handlePushChanges = async (childrenId: string) => {
    const result = await updateSingleLocale(childrenId, parentId, privateKey, apiKey, modelName)
    if (result.status === 200) {
      appState?.snackBar.show(`Suceessfully updated ${childrenId} with new blocks.`);
    }
  };

  const handlePushBatchChanges = async () => {
    appState.globalState.showGlobalBlockingLoading(`Pushing changes for ${localeChildren.map((locale: any) => locale?.target?.value[0]).join(' & ')} ....`);
    const results = localeChildren.map(async (locale: any) => await updateSingleLocale(locale?.reference?.id, parentId, privateKey, apiKey, modelName))
    const final = await Promise.all(results)
    await appState.globalState.hideGlobalBlockingLoading();

    if (!final.filter((res) => res.status !==200).length) {
      appState?.snackBar.show(`Suceessfully updated all locales with new blocks.`);
    }
  };

  return (
    <div style={{ padding: 8, paddingBottom: 64 }}>
      <div style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ marginLeft: 8 }}>Deployed Locales ({localeChildren?.length})</h3>
        {/* <Button onClick={handleRefresh}>refresh</Button> */}
      </div>
      {
        localeChildren?.length === 0 && <>
          <h4>No locales deployed yet.</h4>
          <br />
        </>
      }
      {
        localeChildren?.map((locale: any) => {
          return (
            <LocaleItem
              key={`locale-item-${locale?.reference?.id}`}
              item={locale}
              onPush={() => handlePushChanges(locale?.reference?.id)}
              onForcePush={() => handleForcePush(locale?.reference?.id)}
            />
          )
        })
      }
      <div style={{
          width: '100%', backgroundColor: 'white', position: 'absolute', bottom: 0, left: 0,
          display: 'flex', flexDirection: 'row', justifyContent: 'center',
        }}>
        <Button onClick={handlePushBatchChanges} color="primary" disabled={!localeChildren.length}>
          push changes to all locales ({localeChildren.length})
        </Button>
      </div>
    </div>
  );
}

export default LocalesTab;