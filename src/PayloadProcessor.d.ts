import { ArcRequest } from '@advanced-rest-client/arc-types';

/**
 * A helper class that processes payload before saving it to a
 * datastore or file.
 * It processes `FormData` and `Blob` payloads into string and restores
 * them to original state.
 */
export declare class PayloadProcessor {

  /**
   * Transforms request payload to string if needed.
   * Note, this returns copy of the object if any transformation is applied.
   *
   * @param request ArcRequest object
   * @returns Promise resolved when payload has been processed.
   */
  static payloadToString(request: ArcRequest.ARCHistoryRequest|ArcRequest.ARCSavedRequest): Promise<ArcRequest.ARCHistoryRequest|ArcRequest.ARCSavedRequest>;

  /**
   * Computes `multipart` list value to replace FormData with array that can
   * be stored in the datastore.
   *
   * @param payload FormData object
   * @returns A promise resolved to a datastore safe entries.
   */
  static createMultipartEntry(payload: FormData): Promise<ArcRequest.MultipartTransformer[]>;

  /**
   * Transforms a FormData entry into a safe-to-store text entry
   *
   * @param name The part name
   * @param file The part value
   * @returns Transformed FormData part to a datastore safe entry.
   */
  static computeFormDataEntry(name: string, file: string|File): Promise<ArcRequest.MultipartTransformer>;

  /**
   * Converts blob data to base64 string.
   *
   * @param blob File or blob object to be translated to string
   * @returns Promise resolved to a base64 string data from the file.
   */
  static blobToString(blob: Blob): Promise<string>;

  /**
   * Restores creates payload meta entry into it's original form.
   *
   * @param request ArcRequest object
   * @returns Processed request
   */
  static restorePayload(request: ArcRequest.ARCHistoryRequest|ArcRequest.ARCSavedRequest): ArcRequest.ARCHistoryRequest|ArcRequest.ARCSavedRequest;

  /**
   * Restores FormData from ARC data model.
   *
   * @param model ARC model for multipart.
   * @return Restored form data
   */
  static restoreMultipart(model: ArcRequest.MultipartTransformer[]): FormData;

  /**
   * Converts data-url string to blob
   *
   * @param dataUrl Data url from blob value.
   * @return Restored blob value
   */
  static dataURLtoBlob(dataUrl: string): Blob;
}
