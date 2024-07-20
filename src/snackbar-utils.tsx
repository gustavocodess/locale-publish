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
} from '@material-ui/core';
import { getLocaleOptionsForRole } from './locale-helpers';
import MultiSelector from './components/MultiSelector';

interface Props {
  onChoose: (val: { sourceLang: string; targetLangs: string[] } | null) => void;
  deployedLocales: string[];
  currentLocaleTargets: string[];
  elementsLength?: number;
}

interface ElementProps {
  onChoose: (val: { sourceLang: string; targetLangs: string[] } | null) => void;
  deployedLocales: string[];
  elementsLength?: number;
}

const LocaleConfigurationEditor: React.FC<Props> = props => {
  const store = useLocalStore(() => ({
    targetLangs: [] as string[],
    get availableLangs(): string[] {
      const allowedLocales = getLocaleOptionsForRole().map((item: any) => item.value).filter((locale: any) => !locale.startsWith('Default'));
      return (
        allowedLocales
          .filter((item: string) => !props.deployedLocales.includes(item) && !props.currentLocaleTargets.includes(item)) || []
      );
    },
    sourceLang:
      appState.user.organization.value.customTargetingAttributes?.get('locale')?.toJSON().enum[0],
  }));
  return useObserver(() => (
    <div css={{ margin: 20 }}>
      <div css={{ marginTop: 8, marginBottom: 20 }}>
        <Typography css={{fontWeight: 'bold', fontSize: 16 }}>Push to countries</Typography>
      </div>
      <div>
        <MultiSelector
          options={store.availableLangs.sort()}
          onChange={(values: string[]) => {
            store.targetLangs = [...values]
          }}
        />
      </div>
      <DialogActions>
        <Button onClick={() => props.onChoose(null)} color="default">
          Cancel
        </Button>
        <Button variant="contained" onClick={() => props.onChoose(store)} color="primary">
          Push
        </Button>
      </DialogActions>
    </div>
  ));
};

const ElementConfigurationEditor: React.FC<ElementProps> = props => {
  const store = useLocalStore(() => ({
    all: false,
    targetLangs: [] as string[],
    get availableLangs(): string[] {
      return props.deployedLocales.filter((locale: any) => !locale.startsWith('Default'));
    },
    sourceLang:
      appState.user.organization.value.customTargetingAttributes?.get('locale')?.toJSON().enum[0],
  }));

  return useObserver(() => (
    <div css={{ margin: 20 }}>
      <div css={{ marginTop: 8, marginBottom: 20 }}>
        <Typography css={{fontWeight: 'bold', fontSize: 16 }}>Push {props.elementsLength} component for</Typography>
      </div>
      <div>
        <Typography>Select countries*</Typography>
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
          Push components
        </Button>
      </DialogActions>
    </div>
  ));
};


interface MultiPushProps {
  onChoose: (push: boolean) => void;

}

const MultiLocalePushConfirm: React.FC<MultiPushProps> = props => {
  return useObserver(() => (
    <div css={{ margin: 20 }}>
      <div css={{ marginTop: 8, marginBottom: 20 }}>
        <Typography css={{fontWeight: 'bold', fontSize: 16 }}>Push to countries</Typography>
      </div>
      <div>
        <Typography css={{ fontSize: 14 }}>Are you sure you want to push the changes to all countries?</Typography>
      </div>
      <DialogActions>
        <Button onClick={() => props.onChoose(false)} color="default">
          Cancel
        </Button>
        <Button variant="contained" onClick={() => props.onChoose(true)} color="primary">
          Confirm
        </Button>
      </DialogActions>
    </div>
  ));
};

export async function getLangPicks(deployedLocales: string[], currentLocaleTargets: string[]): Promise<{
  sourceLang: string;
  targetLangs: string[];
} | null> {
  return new Promise(async resolve => {
    const destroy = await appState.globalState.openDialog(
      React.createElement(LocaleConfigurationEditor, {
        deployedLocales: deployedLocales,
        currentLocaleTargets: currentLocaleTargets,
        onChoose: val => {
          resolve(val);
          destroy();
        },
      }),
      true,
      {
        // dialogProps
        disableBackdropClick: true,
      },
      () => resolve(null)
    );
  });
}

export async function getPushConfirmation(): Promise<{} | null> {
  return new Promise(async resolve => {
    const destroy = await appState.globalState.openDialog(
      React.createElement(MultiLocalePushConfirm, {
        onChoose: val => {
          resolve(val);
          destroy();
        },
      }),
      true,
      {
        // dialogProps
        disableBackdropClick: true,
      },
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
        deployedLocales: deployedLocales,
        elementsLength,
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