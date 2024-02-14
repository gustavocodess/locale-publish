/** @jsx jsx */
import { jsx } from '@emotion/core';
import appState from '@builder.io/app-context';
import { action } from 'mobx';
import React from 'react';
import { useObserver, useLocalStore } from 'mobx-react';
import {
  DialogActions,
  Select,
  MenuItem,
  ListItemText,
  Checkbox,
  Typography,
  Button,
  Radio,
} from '@material-ui/core';


export function showPublishedNotification(locale: string, callback?: () => void) {
  appState.snackBar.show(
    <div css={{ display: 'flex', alignItems: 'center' }}>Published for {locale}</div>,
    6000,
    null,
  );
}

export function showJobNotification(projectUid: string) {
  appState.snackBar.show(
    <div css={{ display: 'flex', alignItems: 'center' }}>Done!</div>,
    2000,
    <Button
      color="primary"
      css={{
        pointerEvents: 'auto',
        ...(appState.document.small && {
          width: 'calc(100vw - 90px)',
          marginRight: 45,
          marginTop: 10,
          marginBottom: 10,
        }),
      }}
      variant="contained"
      onClick={async () => {
        const link = `https://cloud.memsource.com/web/project2/show/${projectUid}`;
        window.open(link, '_blank');
        appState.snackBar.open = false;
      }}
    >
      Go to job details
    </Button>
  );
}

export function showOutdatedNotifications(callback: () => void) {
  appState.snackBar.show(
    <div css={{ display: 'flex', alignItems: 'center' }}>Contant has new strings!</div>,
    6000,
    <Button
      color="primary"
      css={{
        pointerEvents: 'auto',
        ...(appState.document.small && {
          width: 'calc(100vw - 90px)',
          marginRight: 45,
          marginTop: 10,
          marginBottom: 10,
        }),
      }}
      variant="contained"
      onClick={async () => {
        callback();
        appState.snackBar.open = false;
      }}
    >
      Request an updated translation
    </Button>
  );
}

interface Props {
  onChoose: (val: { sourceLang: string; targetLangs: string[] } | null) => void;
  deployedLocales: string[];
  elementsLength?: number;
}
const lsKey = 'phrase.sourceLang';

const safeLsGet = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeLsSet = (key: string, value: string) => {
  try {
    return localStorage.setItem(key, value);
  } catch {
    return null;
  }
};

const PhraseConfigurationEditor: React.FC<Props> = props => {
  const store = useLocalStore(() => ({
    targetLangs: [] as string[],
    get availableLangs(): string[] {
      return (
        appState.user.organization.value.customTargetingAttributes
          ?.get('locale')
          ?.toJSON()
          .enum?.filter((locale: string) => locale !== store.sourceLang)
          .filter((item: string) => !props.deployedLocales.includes(item)) || []
      );
    },
    sourceLang:
      safeLsGet(lsKey) ||
      appState.user.organization.value.customTargetingAttributes?.get('locale')?.toJSON().enum[0],
  }));

  return useObserver(() => (
    <div css={{ margin: 20 }}>
      <div css={{ marginTop: 8, marginBottom: 20 }}>
        <Typography css={{fontWeight: 'bold', fontSize: 16 }}>Pick languages for push</Typography>
      </div>
      <div>
        <Typography>Target Languages*</Typography>
        <Select
          multiple
          fullWidth
          value={store.targetLangs}
          placeholder="+ Add a value"
          renderValue={selected => (Array.isArray(selected) ? selected?.join(',') : selected)}
          onChange={action(event => {
            store.targetLangs = [...event.target.value];
          })}
        >
          {
            store.availableLangs.map(locale => (
              <MenuItem key={locale} value={locale}>
                <Checkbox color="primary" checked={store.targetLangs.includes(locale)} />
                <ListItemText primary={locale} />
              </MenuItem>
            ))
          }
        </Select>
      </div>
      <DialogActions>
        <Button onClick={() => props.onChoose(null)} color="default">
          Cancel
        </Button>
        <Button variant="contained" onClick={() => props.onChoose(store)} color="primary">
          Create Locales
        </Button>
      </DialogActions>
    </div>
  ));
};

const ElementConfigurationEditor: React.FC<Props> = props => {
  const store = useLocalStore(() => ({
    all: false,
    targetLangs: [] as string[],
    get availableLangs(): string[] {
      return (
        appState.user.organization.value.customTargetingAttributes
          ?.get('locale')
          ?.toJSON()
          .enum?.filter((locale: string) => locale !== store.sourceLang)
          .filter((item: string) => props.deployedLocales.includes(item)) || []
      );
    },
    sourceLang:
      safeLsGet(lsKey) ||
      appState.user.organization.value.customTargetingAttributes?.get('locale')?.toJSON().enum[0],
  }));

  return useObserver(() => (
    <div css={{ margin: 20 }}>
      <div css={{ marginTop: 8, marginBottom: 20 }}>
        <Typography css={{fontWeight: 'bold', fontSize: 16 }}>Push {props.elementsLength} component for</Typography>
      </div>
      <div>
        <Typography>Target Languages*</Typography>
        <Select
          multiple
          fullWidth
          value={store.targetLangs}
          placeholder="+ Add a value"
          renderValue={selected => (Array.isArray(selected) ? selected?.join(',') : selected)}
          onChange={action(event => {
            store.targetLangs = [...event.target.value];
          })}
        >
          {/* <MenuItem key={`locale-all-45`} value="Push All">
            <Checkbox color="primary" checked={store.all} onChange={() => store.all = !store.all} />
            <ListItemText primary="Push All" />
          </MenuItem> */}
          {
            store.availableLangs.map(locale => (
              <MenuItem key={locale} value={locale}>
                <Checkbox color="primary" checked={store.targetLangs.includes(locale)} />
                <ListItemText primary={locale} />
              </MenuItem>
            ))
          }
        </Select>
      </div>
      <DialogActions>
        <Button onClick={() => props.onChoose(null)} color="default">
          Cancel
        </Button>
        <Button variant="contained" onClick={() => props.onChoose(store)} color="primary">
          Push components
        </Button>
      </DialogActions>
    </div>
  ));
};

export async function getLangPicks(deployedLocales: string[]): Promise<{
  sourceLang: string;
  targetLangs: string[];
} | null> {
  return new Promise(async resolve => {
    const destroy = await appState.globalState.openDialog(
      React.createElement(PhraseConfigurationEditor, {
        deployedLocales: deployedLocales,
        onChoose: val => {
          resolve(val);
          destroy();
        },
      }),
      true,
      {},
      () => resolve(null)
    );
  });
}


export async function getLangsPushElement(deployedLocales: string[], elementsLength: number): Promise<{
  sourceLang: string;
  targetLangs: string[];
} | null> {
  return new Promise(async resolve => {
    const destroy = await appState.globalState.openDialog(
      React.createElement(ElementConfigurationEditor, {
        elementsLength,
        deployedLocales: deployedLocales,
        onChoose: val => {
          resolve(val);
          destroy();
        },
      }),
      true,
      {},
      () => resolve(null)
    );
  });
}