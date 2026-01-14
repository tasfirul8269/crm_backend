To deactivate an agent (User) in your CRM so that the change reflects on Property Finder, you must update the user's status to inactive. Based on the API documentation, this is handled through the **Users** endpoint rather than the Public Profile endpoint directly.

### **Deactivation Documentation**

#### **1\. Authentication**

All requests require a Bearer token in the header. You must first obtain this using your API Key and Secret.

* **Endpoint:** POST /v1/auth/token 1

* **Header:** Content-Type: application/json 2

* **Payload:**  
  JSON  
  {  
    "apiKey": "\<YOUR\_API\_KEY\>",  
    "apiSecret": "\<YOUR\_API\_SECRET\>"  
  }  
  \`\`\` \[cite: 509\]

#### **2\. Identify the Agent (User ID)**

Before deactivating, you need the unique id of the user/agent. You can find this by searching for the user.

* **Endpoint:** GET /v1/users/ 

* **Query Parameters (Optional):** You can filter by email or name (e.g., ?email=agent@example.com).

* **Response:** Look for the id field in the data array.

#### **3\. Deactivate the Agent**

To deactivate the agent, use the PATCH method on the specific user ID and set the isActive flag to false.

* **Endpoint:** PATCH /v1/users/{id} 

* **Method:** PATCH 

* **Headers:**  
  * Authorization: Bearer \<ACCESS\_TOKEN\> 

  * Content-Type: application/json 

* **Request Body:**  
  JSON  
  {  
    "isActive": false  
  }  
  \`\`\` \[cite: 527, 528\]

* **Expected Response:** 204 No Content (indicates the update was successful).

#### **4\. Impact and Considerations**

* **Listing Visibility:** Every published listing **must** be associated with a valid Public Profile (agent). Deactivating a user may prevent their associated listings from being updated or may lead to them being unpublished if the system requires an active agent for live listings.

* **Public Profile vs. User:** While you update the isActive status at the User level, the Public Profile (which contains the name and bio displayed on the website) is linked to this user. Deactivating the user effectively removes their professional presence from the portal search results

* **Verification Status:** If an agent was previously verified, their verification status is tracked via publicProfile.verification15. Deactivating the user does not necessarily delete the verification data but makes the profile inactive for public use

#### **5\. Error Handling**

* **401 Unauthorized:** Your access token has expired. Tokens are valid for 30 minutes (1800 seconds)

* **404 Not Found:** The User ID provided does not exist in the system  
* **429 Rate Limited:** You have exceeded the limit of 650 requests per minute for this endpoint  
