/**
 * A helper class that processes payload before saving it to a
 * datastore or file.
 * It processes `FormData` and `Blob` payloads into string and restores
 * them to original state.
 */
export class PayloadProcessor {
  /**
   * Transforms request pyload to string if needed.
   * Note, this returns copy of the object if any transformation is applied.
   *
   * @param {Object} request ArcRequest object
   * @return {Promise} Promise resolved when payload has been processed.
   */
  static payloadToString(request) {
    if (!request.payload) {
      return Promise.resolve(request);
    }
    if (request.payload instanceof FormData) {
      const data = Object.assign({}, request);
      if (!data.payload.entries) {
        data.payload = undefined;
        return Promise.resolve(data);
      }
      return PayloadProcessor._createMultipartEntry(data.payload)
      .then((entry) => {
        data.payload = undefined;
        data.multipart = entry;
        return data;
      });
    } else if (request.payload instanceof Blob) {
      const data = Object.assign({}, request);
      return PayloadProcessor._blobToString(data.payload)
      .then((str) => {
        data.payload = undefined;
        data.blob = str;
        return data;
      });
    }
    return Promise.resolve(request);
  }

  /**
   * Computes `multipart` list value to replace FormData with array that can
   * be stored in the datastore.
   *
   * @param {FormData} payload FormData object
   * @return {Promise} Promise resolved to a form part representation.
   */
  static _createMultipartEntry(payload) {
    const iterator = payload.entries();
    let textParts;
    if (payload._arcMeta && payload._arcMeta.textParts) {
      textParts = payload._arcMeta.textParts;
    }
    return PayloadProcessor._computeFormDataEntry(iterator, textParts);
  }
  /**
   * Recuresively iterates over form data and appends result of creating the
   * part object to the `result` array.
   *
   * Each part entry contains `name` as a form part name, value as a string
   * representation of the value and `isFile` to determine is the value is
   * acttually a string or a file data.
   *
   * @param {Iterator} iterator FormData iterator
   * @param {?Array<String>} textParts From `_arcMeta` property. List of blobs
   * that should be treated as text parts.
   * @param {?Array<Object>} result An array where the results are appended to.
   * It creates new result object when it's not passed.
   * @return {Promise} A promise resolved to the `result` array.
   */
  static _computeFormDataEntry(iterator, textParts, result) {
    result = result || [];
    const item = iterator.next();
    if (item.done) {
      return Promise.resolve(result);
    }
    const entry = item.value;
    const name = entry[0];
    const value = entry[1];
    let promise;
    let isBlob = false;
    let isTextBlob = false;
    if (value instanceof Blob) {
      promise = PayloadProcessor._blobToString(value);
      if (textParts && textParts.indexOf(name) !== -1) {
        isBlob = false;
        isTextBlob = true;
      } else {
        isBlob = true;
      }
    } else {
      promise = Promise.resolve(value);
    }
    return promise
    .then((str) => {
      const _part = {
        name: name,
        value: str,
        isFile: isBlob
      };
      if (isTextBlob) {
        _part.isTextBlob = isTextBlob;
      }
      return _part;
    })
    .then((part) => {
      result.push(part);
      return PayloadProcessor._computeFormDataEntry(
        iterator, textParts, result);
    });
  }
  /**
   * Converts blob data to base64 string.
   *
   * @param {Blob} blob File or blob object to be translated to string
   * @return {Promise} Promise resolved to a base64 string data from the file.
   */
  static _blobToString(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = function(e) {
        resolve(e.target.result);
      };
      reader.onerror = function() {
        reject(new Error('Unable to convert blob to string.'));
      };
      reader.readAsDataURL(blob);
    });
  }
  /**
   * Restores creates payload meta entry into it's original form.
   * @param {Object} request ArcRequest object
   * @return {Object} Processed request
   */
  static restorePayload(request) {
    if (request.multipart) {
      try {
        request.payload = this.restoreMultipart(request.multipart);
      } catch (e) {
        console.warn('Unable to restore payload.', e);
      }
      delete request.multipart;
    } else if (request.blob) {
      try {
        request.payload = this._dataURLtoBlob(request.blob);
      } catch (e) {
        console.warn('Unable to restore payload.', e);
      }
      delete request.blob;
    }
    return request;
  }
  /**
   * Restores FormData from ARC data model.
   *
   * @param {Array<Object>} model ARC model for multipart.
   * @return {FormData} Restored form data
   */
  static restoreMultipart(model) {
    const fd = new FormData();
    if (!model || !model.length) {
      return fd;
    }
    fd._arcMeta = {
      textParts: []
    };
    model.forEach((part) => {
      const name = part.name;
      let value;
      if (part.isFile) {
        try {
          value = PayloadProcessor._dataURLtoBlob(part.value);
        } catch (e) {
          value = '';
        }
      } else {
        value = part.value;
        if (part.isTextBlob) {
          fd._arcMeta.textParts.push(name);
          try {
            value = PayloadProcessor._dataURLtoBlob(part.value);
          } catch (e) {
            value = '';
          }
        }
      }
      fd.append(name, value);
    });
    return fd;
  }

  /**
   * Converts dataurl string to blob
   *
   * @param {String} dataurl Data url from blob value.
   * @return {Blob} Restored blob value
   */
  static _dataURLtoBlob(dataurl) {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], {type: mime});
  }
}
