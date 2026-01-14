Resale \- Ready to move

Resale \- Off-plan

Primary \- Ready to move

Primary \- Off-Plan

Instead, those four options are created by combining **two different fields** in your JSON code. If your "Project Status" isn't showing up, it's because your backend isn't sending this specific combination correctly.

Here is exactly how to map your CRM dropdown to the API:

### **1\. The Mapping Secret**

To get the result you see in the frontend, your JSON must send the fields like this:

| What you select in CRM | offering\_type (Field 1\) | project\_status (Field 2\) |
| :---- | :---- | :---- |
| **Resale \- Ready to move** | "sale" | "completed" |
| **Resale \- Off-plan** | "sale" | "off-plan" |
| **Primary \- Ready to move** | "primary-sale" | "completed" |
| **Primary \- Off-Plan** | "primary-sale" | "off-plan" |

### **2\. Why your "Project Status" is likely failing**

The most common reason the "Project Status" part fails to sync is the **Completion Date rule**.

If you send "project\_status": "off-plan", the Property Finder API **will ignore it** unless you also include the completion date in the same request.

**Correct JSON for Off-Plan:**

JSON

{  
  "offering\_type": "sale",  
  "project\_status": "off-plan",  
  "completion\_date": "2027-06"   
}

*Note: The date must be in YYYY-MM format.*

### **3\. Check these common mistakes:**

* **Key Name:** Ensure your developer used project\_status (underscore) and not projectStatus (camelCase).  
* **Value Names:** Ensure the values are lowercase: completed or off-plan. If you send "Ready to move" as a string, the API will reject it.  
* **Nesting:** Ensure these fields are at the "root" of your JSON object, not hidden inside a sub-folder like extra\_fields.

### **Summary of all Sell Fields to send:**

1. **offering\_type**: "sale" or "primary-sale"  
2. **project\_status**: "completed" or "off-plan"  
3. **completion\_date**: Required if status is off-plan.