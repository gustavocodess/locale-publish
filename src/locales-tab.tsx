import React from 'react';
import {
  Button,
} from '@material-ui/core';
import appState from '@builder.io/app-context';
import { forcePushLocale, repushSingleLocale } from './locale-helpers';
import LocaleItem from './locale-item';
import { fastClone } from './plugin-helpers';
import { getPushConfirmation } from './snackbar-utils';

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

  const handleForcePush = async (childrenId: string) => {
    await appState.globalState.showGlobalBlockingLoading(`Pushing changes...`);
    const result = await forcePushLocale(childrenId, privateKey, apiKey ,modelName)
    if (result.status === 200) {
      appState?.snackBar.show(`Suceessfully updated ${childrenId} with global master blocks.`);
    }
    await appState.globalState.hideGlobalBlockingLoading();
  };

  const handlePushChanges = async (childrenId: string) => {
    const result = await repushSingleLocale(childrenId, privateKey, apiKey, modelName)
    if (result.status === 200) {
      appState?.snackBar.show(`Suceessfully updated ${childrenId} with new blocks.`);
    }
  };

  const handlePushBatchChanges = async () => {
    const response = await getPushConfirmation()
    if (!response) {
      return
    }
    appState.globalState.showGlobalBlockingLoading(`Pushing changes for ${localeChildren.map((locale: any) => locale?.target?.value[0]).join(' & ')} ....`);
    const results = localeChildren.map(async (locale: any) => await repushSingleLocale(locale?.referenceId, privateKey, apiKey, modelName))
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
              key={`locale-item-${locale?.referenceId}`}
              item={locale}
              onPush={() => handlePushChanges(locale?.referenceId)}
              onForcePush={() => handleForcePush(locale?.referenceId)}
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