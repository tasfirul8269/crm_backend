To implement the Property Finder Enterprise API in your CRM for publishing and unpublishing properties, you must follow a specific Compliance → Draft → Publish workflow.

\+1

### 1\. Mandatory Core Process (Publishing)

Property Finder's API requires a two-step submission process to go live:

\+3

* Step A: Create a Draft \* Endpoint: POST /v1/listings  
  * Action: This creates the property in your portal but it is not live yet.  
    \+1  
* Step B: Move to Live \* Endpoint: POST /v1/listings/{id}/publish  
  * Action: This moves the property from Draft to Live.  
    \+3

### 2\. Mandatory Core Process (Unpublishing)

To stop a listing from being live without permanently deleting it:

* Endpoint: POST /v1/listings/{id}/unpublish   
  \+1  
* Action: This temporarily removes the listing from the public website.  
  \+1

### 3\. Updating Existing Listings

Property Finder does not support partial updates (sending only changed fields). You must use Full Resource Replacement.

* Endpoint: PUT /v1/listings/{listing\_id}   
* Rule: You must send the entire JSON body every time. If you only send a new title, other fields like price or images will be deleted or the request will be rejected.  
* Workflow for Developers:  
  1. Fetch: GET /v1/listings/{id} to get current data.  
  2. Merge: Replace old values with new values from your CRM.  
  3. Push: PUT /v1/listings/{id} with the full updated object.

### 4\. Critical Implementation Rules (Dubai/UAE)

* Compliance Verification: Before publishing, you must validate the RERA permit and agency license.  
  \+2  
  * Endpoint: GET /v1/compliances/{permitNumber}/{licenseNumber}?permitType=rera   
    \+2  
  * Note: The API strictly requires your numeric ORN (e.g., "12345"), not your company's text name.  
* Location IDs: You cannot use raw text names or Google Place IDs. You must use a valid location.id from the Property Finder "Location Tree".  
  * Endpoint: GET /v1/locations?search={name}   
* Amenities: You must use standardized lowercase slugs (e.g., central-ac instead of "Central Air Conditioning").  
  \+1  
* Validation Standards:  
  * Description: Must be between 750 and 2,000 characters.  
  * Title: Must be between 30 and 50 characters.  
  * Price: Must be sent as an integer/number, not a string.

### 5\. Authentication

Every request must include a Bearer Token in the header.

\+1

* Endpoint: POST /v1/auth/token  
* Payload: Use your apiKey and apiSecret.  
  \+1  
* Note: Tokens expire after 30 minutes; your CRM must handle re-authentication

