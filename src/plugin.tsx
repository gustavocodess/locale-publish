import { registerCommercePlugin as registerPlugin } from '@builder.io/commerce-plugin-tools';
import { reaction } from 'mobx'
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
import { getLocaleOptionsForRole, pushToLocales, updateSelectedElements } from './locale-helpers';

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
          if (!isGlobal) {
            delete Builder.registry['editor.editTab']
          } else if (isGlobal && !Builder.registry['editor.editTab']) {
            registerLocalesTab(privateKey);
          }

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
      label: `Push for locale`,
      showIf(content, model) {
        const isGlobal = fastClone(content?.data)?.isGlobal
        return isGlobal;
      },
      async onClick(content) {
        const locale = appState.designerState?.activeLocale || 'Default';
        const modelName = content.modelName;

        const localeChildren = fastClone(appState.designerState.editingContentModel?.data?.get("localeChildren")?? [])

        const deployedLocales = localeChildren.map((locale: any) => locale?.target?.value[0])
        
        const currentLocaleTargets = getQueryLocales(appState?.designerState?.editingContentModel)

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
          const isGlobal = appState?.designerState?.editingContentModel?.data?.get("isGlobal");
          // todo: maybe apply for multiple??
          return isGlobal;
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
        picks?.targetLangs?.map(async (pick: any) => {
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
