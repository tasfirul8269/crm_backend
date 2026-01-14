To send a property for verification using the Property Finder Enterprise API, you must follow a structured workflow that varies depending on the region (notably Dubai) and the eligibility of the listing.

### **1\. General Workflow for Verification**

The verification process typically involves checking eligibility before submitting a request. For some regions, this process is automated1111.

\+2

* **Check Eligibility:** Before initiating verification, call the eligibility endpoint to determine if the listing meets the technical and business criteria (e.g., location, quality score, agent status)2.

  * **Endpoint:** POST /v1/listing-verifications/check-eligibility 3333  
    \+1

  * **Response:** Returns flags such as eligible (can be verified) and autoSubmit (qualifies for automated verification)4444.

* **Manual Submission:** If the listing is eligible but not automatically submitted, you must create a submission manually5.

  * **Endpoint:** POST /v1/listing-verifications 6

  * **Details:** This request typically includes the listingId and any required supporting documents (like Form A or Title Deeds)7777.

* **Resubmission:** If an automated submission is rejected (often due to temporary data mismatches), it can be re-activated88.  
  \+1

  * **Endpoint:** POST /v1/listing-verifications/{submissionId}/resubmit 9999  
    \+1

### **2\. Verification Criteria**

To successfully verify a property, the following criteria must be met101010101010:

\+2

* **Listing Quality:** The listing must meet specific quality score thresholds11111111.

* **Agent Eligibility:** The agent/broker associated with the listing must be in good standing and eligible for verification12121212.

* **Location Rules:** The property must be in a supported city; some locations may be excluded from the verification service13131313.

* **No Active Submissions:** There cannot be an existing pending or active verification submission for the same listing14141414.

### **3\. Dubai-Specific Requirements (Mandatory)**

For listings in Dubai, verification is **automatically triggered** after the listing is published, provided it complies with the Dubai Land Department (DLD) records15151515.

\+2

* **DLD Compliance:** You must retrieve and match official permit details before creating the listing16161616.  
  \+1

  * **Endpoint:** GET /v1/compliances/{permitNumber}/{licenseNumber} 17171717  
    \+1

* **Strict Adherence:** Any discrepancy between your listing and the DLD data (Price, Property Type, or Location) will result in an immediate rejection of the verification18181818.  
  \+1

* **Mandatory Fields:** Permit ID and License Number are required for the listing to be published and subsequently verified19191919.  
  \+1

### **4\. Summary of Key Endpoints**

| Action | Endpoint | Method |
| :---- | :---- | :---- |
| **Check Eligibility** | /v1/listing-verifications/check-eligibility | POST |
| **Create Submission** | /v1/listing-verifications | POST |
| **Resubmit (Auto-only)** | /v1/listing-verifications/{submissionId}/resubmit | POST |
| **DLD Permit Lookup** | /v1/compliances/{permitNumber}/{licenseNumber} | GET |
| **List Submissions** | /v1/listing-verifications | GET |

