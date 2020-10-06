# ARC payload processor

A class that is responsible for processing payload message and prepare it to be
stored in the data store and restoring corresponding data when restoring from the store.

## Example

### Storing FormData

```javascript
const fd = new FormData();
fs.add('field', new Blob(['test']));

PayloadProcessor.payloadToString({payload: fd})
.then((result) => {
  console.log(result);
});
```

### Storing Blob

```javascript

PayloadProcessor.payloadToString({payload: new Blob(['test'])})
.then((result) => {
  console.log(result);
});
```
