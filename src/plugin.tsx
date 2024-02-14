import { registerCommercePlugin as registerPlugin } from '@builder.io/commerce-plugin-tools';
import { reaction } from 'mobx'
import { Builder } from '@builder.io/sdk';
import pkg from '../package.json';
import appState from '@builder.io/app-context';

import {
  registerContentAction,
  registerContextMenuAction,
  fastClone,
  registerEditorOnLoad,
  registerLocalesTab,
} from './plugin-helpers';
import { getLangPicks, getLangsPushElement } from './snackbar-utils';
import { pushToLocales, updateSelectedElements } from './locale-helpers';

let registerTab = false

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
          const draftClone = fastClone(appState?.designerState?.editingContentModel);
          const isGlobal = draftClone?.data?.isGlobal

          if (isGlobal && !registerTab) {
            // register only once flag
            registerTab = true
            registerLocalesTab(privateKey);
          }
          return draftClone;
        },
        async (content: any) => {        
        },
        {
          fireImmediately: true,
        }
      );
    });

    registerContentAction({
      label: `Push for locale`,
      showIf(content, model) {
        // const locale = appState.designerState?.activeLocale || 'Default';
        // return locale !== 'Default';
        return true;
      },
      async onClick(content) {
        const locale = appState.designerState?.activeLocale || 'Default';
        const modelName = content.modelName;

        const localeChildren = fastClone(appState.designerState.editingContentModel?.data?.get("localeChildren")?? [])

        const deployedLocales = localeChildren.map((locale: any) => locale?.target?.value[0])

        const picks = await getLangPicks(deployedLocales);
        const localesToPublish = picks?.targetLangs.map(e => e)
        if (!picks || !localesToPublish) {
          appState.globalState.hideGlobalBlockingLoading();
          return;
        }

        appState.globalState.showGlobalBlockingLoading(`Publishing for ${localesToPublish.join(' & ')} ....`);
        const success = await pushToLocales(localesToPublish, fastClone(content), privateKey, modelName);

        if (success) {
          appState.snackBar.show(`Published content for ${localesToPublish.join(' & ')}.`);
          // update parent with children references created
        } else {
          appState.snackBar.show(`Error publishing for ${locale}. Contact Admin.`);
        }
        appState.globalState.hideGlobalBlockingLoading();
        }
      },
    );


    registerContextMenuAction({
      label: 'Push Component for Locales',
      showIf(selectedElements) {
        if (selectedElements.length === 1) {
          // todo: maybe apply for multiple??
          return true;
        }
        return false;
      },
      async onClick(elements) {

        const localeChildren = fastClone(appState.designerState.editingContentModel?.data?.get("localeChildren")?? [])

        const deployedLocales = localeChildren.map((locale: any) => locale?.target?.value[0])
        const picks = await getLangsPushElement(deployedLocales, elements.length);

        if (!picks?.targetLangs?.length) {
          return;
        }
        const masterClone = fastClone(appState.designerState.editingContentModel)
        const apiKey = fastClone(appState?.user?.apiKey)
        appState.globalState.showGlobalBlockingLoading(`Publishing for ${picks?.targetLangs.join(' & ')} ....`);

        const localeMap = {} as any
        localeChildren?.map((children: any) => {
          localeMap[children?.target?.value[0]] = children
        })
        const updates: any[]= []
        picks?.targetLangs?.map(async (pick: any, index: number) => {
          const childrenId = localeMap[pick]?.reference?.id
          const childrenModel = localeMap[pick]?.reference?.model
          updates.push(updateSelectedElements(childrenId, masterClone, privateKey, apiKey, childrenModel, elements[0]))
        })

        const allUpdated = await Promise.all(updates).then((data) => data);
        await appState.globalState.hideGlobalBlockingLoading();

        // check if all results return oks from Write API
        if (allUpdated.filter((ok: boolean) => !ok)?.length) {
          appState.snackBar.show(`Error publishing component. Contact Admin.`);
        } else {
          appState.snackBar.show(`Succesfully pushed component for ${picks?.targetLangs?.length} locales.`);
        }
      },
    });

    return {};
  }
);
