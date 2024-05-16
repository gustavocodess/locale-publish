import React from "react";
import { TextField, Autocomplete, MenuItem } from "@mui/material";
import {Check as CheckIcon} from "@material-ui/icons"

interface Props {
  options: string[];
  onChange: (values: string[]) => void; 
}
export default function MultiSelector(props: Props) {
  const [isSelectedAll, setIsSelectedAll] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>([])
  return (
    <div style={{ padding: 6, borderRadius: 4, backgroundColor: 'white' }}>
      <Autocomplete
        sx={{ width: 400 }}
        multiple
        value={selected}
        options={['Select All', ...props.options]}
        getOptionLabel={(option) => option}
        disableCloseOnSelect
        onChange={(event, value) => {
          if (value.includes('Select All')) {
            if (isSelectedAll) {
              setSelected([]);
              props.onChange([]);
              setIsSelectedAll(false)
              return
            }
            setIsSelectedAll(true)
            const values = props.options.sort();
            props.onChange(values);
            setSelected(values);
            return
          }
          const values = value.sort();
          props.onChange(values);
          setSelected(values);
          setIsSelectedAll(false)
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            variant="outlined"
            label="Select countries*"
            placeholder="Select one or multiple languages"
            style={{ backgroundColor: 'white'}}
          />
        )}
        renderOption={(props, option, { selected }) => (
          <MenuItem
            {...props}
            key={option}
            value={option}
            sx={{ justifyContent: "space-between" }}
          >
            {option}
            {selected || isSelectedAll ? <CheckIcon color="primary" /> : null}
          </MenuItem>
        )}
      />
    </div>
  );
}