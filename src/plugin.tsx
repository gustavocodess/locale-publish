import { registerCommercePlugin as registerPlugin } from '@builder.io/commerce-plugin-tools';
import { Builder } from '@builder.io/react';
import pkg from '../package.json';
import appState from '@builder.io/app-context';

import {
  registerContentAction,
  registerContextMenuAction,
  fastClone,
  registerEditorOnLoad,
  registerLocalesTab,
  getQueryLocales,
} from './plugin-helpers';
import { getLangPicks, getLangsPushElement } from './snackbar-utils';
import { pushToLocales } from './locale-helpers';
import { createDuplicate } from './locale-service';
import WordsCountButton from './components/WordCounter';
import traverse from 'traverse';

const WORD_COUNTER_NAME = 'Words counter'
if (Builder.registry &&
  !Builder.registry['editor.toolbarButton']?.filter(
    (item: any) => item.name === WORD_COUNTER_NAME).length) {
  Builder.register('editor.toolbarButton', {
    name: WORD_COUNTER_NAME,
    component: () => WordsCountButton(),
  });
}

registerPlugin(
  {
    name: 'Publish for Locale',
    id: pkg.name,
    settings: [
      {
        name: 'privateKey',
        type: 'string',
        required: true,
      },
    ],
    ctaText: `Connect your localization plugin`,
    noPreviewTypes: true,
  },
  async settings => {
    const privateKey = settings.get('privateKey');

    registerEditorOnLoad(({ safeReaction }) => {
      safeReaction(
        () => {
          appState.designerState.editorOptions.disableOverflowButtons = ['duplicate', 'delete']
          // Set default locale to the one targeted
          const currentLocaleTargets = getQueryLocales(appState?.designerState?.editingContentModel)
          if (currentLocaleTargets?.length && currentLocaleTargets[0]) {
            if (currentLocaleTargets[0] === 'en-AA') {
              appState.designerState.activeLocale = 'Default'
            } else {
              appState.designerState.activeLocale = currentLocaleTargets[0]
            }
          }

          // console.log('locales ', fastClone(appState.user.organization?.value.customTargetingAttributes))
          // get('enum')

          // registering tab only once 
          const draftClone = fastClone(appState?.designerState?.editingContentModel);
          const isGlobal = draftClone?.data?.isGlobal
          if (!isGlobal) {
            delete Builder.registry['editor.editTab']
            appState.designerState.editorOptions.disableTargetingFields = ['urlPath', 'url', 'locale']
          } else if (isGlobal && !Builder.registry['editor.editTab']) {
            registerLocalesTab(privateKey);
            appState.designerState.editorOptions.disableTargetingFields = []
          }

          // const currentBlocks = JSON.parse(draftClone?.data?.blocksString) || []
          // console.log('blocks ', currentBlocks)

          // Hidding isGlobal manually
          const { designerState } = appState;
          const { editingContentModel } = designerState;
          const isGlobalField = editingContentModel?.useFields?.filter((field: any) => field.name === 'isGlobal') || [];
          if (isGlobalField && isGlobalField.length) {
            isGlobalField[0].hidden = true;
          }
          // const newFields = editingContentModel?.useFields?.filter((field: any) => field.name !== 'isGlobal') || [];  
          // appState.designerState.editingContentModel.useFields = [...newFields, ...isGlobalField];
          // end Hidding isGlobal manually

          return draftClone;
        },
        async (content: any) => {
          return false;

        },
        {
          fireImmediately: true,
        }
      );
    });

    registerContentAction({
      label: `Custom Duplicate`,
      showIf() {
        return true;
      },
      async onClick() {
        const clone = fastClone(appState.designerState.editingContentModel)
        const modelName = appState.designerState.editingContentModel.modelName;

        const cloneBlocks = clone?.data?.blocksString || null
        appState.globalState.showGlobalBlockingLoading(`Duplicating entry...`);
        const newData = {
          ...clone?.data,
          localeChildren: [],
          parent: null,
          blocks: (JSON.parse(cloneBlocks)?? []),
        }
        const payload = {
          ...clone,
          data: newData,
          name: 'copy ' + clone.name,
          isCopy: clone.id,
          published: "draft",
        }
        delete payload.id
        const result = await createDuplicate(payload, privateKey, modelName);
        result.json().then((data: any) => {
          if (data.id) {
            appState.snackBar.show(`Page copy created. Redirecting...`);
            appState.location.go(`/content/${data.id}`);
          } else {
            appState.snackBar.show(`Error creating copy. Contact your administrator`);
          }
        })
        
        appState.globalState.hideGlobalBlockingLoading();
        }
      },
    );

    registerContentAction({
      label: `Push for locale`,
      showIf(content) {
        const isGlobal = fastClone(content?.data)?.isGlobal
        return isGlobal;
      },
      async onClick(content) {
        const locale = appState.designerState?.activeLocale || 'Default';
        const modelName = content.modelName;

        const currentLocaleTargets = getQueryLocales(appState?.designerState?.editingContentModel)
        if (!currentLocaleTargets || !currentLocaleTargets.length) {
          const newErrorObj = { id: `toggled-123`, level: "error", message: "Please have at least one locale targeted before pushing.", };
          appState.designerState.errorWarnings = [...appState.designerState.errorWarnings, newErrorObj]
          appState.snackBar.show(`Please have at least one locale targeted before pushing.`);
          return;
        }

        const localeChildren = fastClone(appState.designerState.editingContentModel?.data?.get("localeChildren")?? [])
        const deployedLocales = localeChildren.map((locale: any) => locale?.target?.value[0])
        const picks = await getLangPicks(deployedLocales, currentLocaleTargets);
        const localesToPublish = picks?.targetLangs.map(e => e)
        if (!picks || !localesToPublish) {
          appState.globalState.hideGlobalBlockingLoading();
          return;
        }

        const clone = fastClone(content)?.data?.blocksString || null
        const newBlocks = (JSON.parse(clone)?? []).map((block: any) => ({...block, meta: {...block.meta, masterId: block.id}}));
        if (!newBlocks || !newBlocks.length) {
          appState.snackBar.show(`No content to push, please have at least one element before pushing.`);
          return 
        }
        appState.globalState.showGlobalBlockingLoading(`Pushing for ${localesToPublish.join(' & ')} ....`);
        const success = await pushToLocales(localesToPublish, fastClone(content), privateKey, modelName);

        if (success) {
          appState.snackBar.show(`Pushed content to ${localesToPublish.join(' & ')}.`);
          // update parent with children references created
        } else {
          appState.snackBar.show(`Error pushing for ${locale}. Contact Admin.`);
        }
        appState.globalState.hideGlobalBlockingLoading();
        }
      },
    );

    return {};
  }
);

