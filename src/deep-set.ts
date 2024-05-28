export const deepSet = (obj: any, path: string, value: any, create: boolean) => {
  let properties = path.split('.')
  let currentObject = obj
  let property: string | undefined

  create = create === undefined ? true : create

  while (properties.length) {
    property = properties.shift()
    
    if (!currentObject) break;
    
    if (!isObject(currentObject[property!]) && create) {
      currentObject[property!] = {}
    }

    if (!properties.length){
      currentObject[property!] = value
    }
    currentObject = currentObject[property!]
  }

  return obj
}
  
function isObject(obj: any) {
  return typeof obj === 'object' && obj !== null
}
