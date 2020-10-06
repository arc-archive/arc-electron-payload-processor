/** @typedef {import('@advanced-rest-client/arc-types').ArcRequest.ARCHistoryRequest} ARCHistoryRequest */
/** @typedef {import('@advanced-rest-client/arc-types').ArcRequest.ARCSavedRequest} ARCSavedRequest */
/** @typedef {import('@advanced-rest-client/arc-types').ArcRequest.MultipartTransformer} MultipartTransformer */

/**
 * A helper class that processes payload before saving it to a
 * datastore or file.
 * It processes `FormData` and `Blob` payloads into string and restores
 * them to original state.
 */
export class PayloadProcessor {
  /**
   * Transforms request payload to string if needed.
   * Note, this returns copy of the object if any transformation is applied.
   *
   * @param {ARCHistoryRequest|ARCSavedRequest} request ArcRequest object
   * @return {Promise<ARCHistoryRequest|ARCSavedRequest>} A copy of the request object with transformed payload
   */
  static async payloadToString(request) {
    if (!request.payload) {
      return request;
    }
    if (request.payload instanceof FormData) {
      const data = { ...request };
      const body = /** @type FormData */ (data.payload);
      // @ts-ignore
      if (!body.entries) {
        data.payload = undefined;
        return data;
      }
      const entry = await PayloadProcessor.createMultipartEntry(body);
      data.payload = undefined;
      data.multipart = entry;
      return data;
    } else if (request.payload instanceof Blob) {
      const data = { ...request };
      const body = /** @type Blob */ (data.payload);
      const result = await PayloadProcessor.blobToString(body);
      data.payload = undefined;
      data.blob = result;
      return data;
    }
    return request;
  }

  /**
   * Computes `multipart` list value to replace FormData with array that can
   * be stored in the datastore.
   *
   * @param {FormData} payload FormData object
   * @return {Promise<MultipartTransformer[]>} A promise resolved to a datastore safe entries.
   */
  static createMultipartEntry(payload) {
    const promises = [];
    // @ts-ignore
    for(const pair of payload.entries()) {
      const [name, file] = pair;
      promises.push(PayloadProcessor.computeFormDataEntry(name, file));
    }
    return Promise.all(promises);
  }

  /**
   * Transforms a FormData entry into a safe-to-store text entry
   *
   * @param {string} name The part name
   * @param {string|File} file The part value
   * @return {Promise<MultipartTransformer>} Transformed FormData part to a datastore safe entry.
   */
  static async computeFormDataEntry(name, file) {
    if (typeof file === 'string') {
      // when adding an item to the FormData object without 3rd parameter of the append function
      // then  the value is a string.
      return {
        isFile: false,
        name,
        value: file,
      };
    }
    const value = await PayloadProcessor.blobToString(file);
    const part = /** @type MultipartTransformer */ ({
      isFile: false,
      name,
      value,
    });
    if (file.name === 'blob') {
      // ARC adds the "blob" filename when the content type is set on the editor.
      // otherwise it wouldn't be possible to set the content type value.
      part.type = file.type;
    } else {
      part.isFile = true;
      part.fileName = file.name;
    }
    return part;
  }

  /**
   * Converts blob data to base64 string.
   *
   * @param {Blob} blob File or blob object to be translated to string
   * @return {Promise<string>} Promise resolved to a base64 string data from the file.
   */
  static blobToString(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = function(e) {
        resolve(String(e.target.result));
      };
      reader.onerror = function() {
        reject(new Error('Unable to convert blob to string.'));
      };
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Restores the payload into its original format.
   * 
   * @param {ARCHistoryRequest|ARCSavedRequest} request ArcRequest object
   * @return {ARCHistoryRequest|ARCSavedRequest} Processed request
   */
  static restorePayload(request) {
    if (request.multipart) {
      try {
        request.payload = PayloadProcessor.restoreMultipart(request.multipart);
      } catch (e) {
        console.warn('Unable to restore payload.', e);
      }
      delete request.multipart;
    } else if (request.blob) {
      try {
        request.payload = PayloadProcessor.dataURLtoBlob(request.blob);
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
   * @param {MultipartTransformer[]} model ARC model for multipart.
   * @return {FormData} Restored form data
   */
  static restoreMultipart(model) {
    const fd = new FormData();
    if (!Array.isArray(model) || !model.length) {
      return fd;
    }
    model.forEach((part) => {
      const { isFile, name, value, type, fileName } = part;
      let blob;
      if (isFile) {
        blob = PayloadProcessor.dataURLtoBlob(value);
        fd.append(name, blob, fileName);
      } else if (type) {
        blob = PayloadProcessor.dataURLtoBlob(value);
        fd.append(name, blob, 'blob');
      } else {
        fd.append(name, value);
      }
    });
    return fd;
  }

  /**
   * Converts data-url string to blob
   *
   * @param {string} dataUrl Data url from blob value.
   * @return {Blob} Restored blob value
   */
  static dataURLtoBlob(dataUrl) {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }
}
