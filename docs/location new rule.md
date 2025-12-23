## **Technical Documentation: Location Synchronization**

### **1\. The Problem: "ID vs. Name"**

* **Property Finder API:** Sends { "location": { "id": 50 } }.  
* **Your CRM:** Expects "Dubai Marina".  
* **The Gap:** Your CRM is missing the "dictionary" that says 50 \= Dubai Marina.

### **2\. The Implementation Strategy (Master Table)**

The most efficient way to handle this is to cache Property Finder's **Location Tree** inside your CRM database.

#### **Step A: Download the Master Location List**

Once a month (or whenever you find a "missing" location), your developer should call the Locations endpoint to fetch the full directory.

* **Endpoint:** GET /v1/locations  
* **Query Parameter:** Use ?search= with a blank value or a specific keyword to get results.  
* **The Response you will get:**

JSON

{  
  "data": \[  
    {  
      "id": 50,  
      "name": "Dubai Marina",  
      "path\_name": "Dubai \> Dubai Marina",  
      "coordinates": { "lat": 25.07, "lng": 55.14 }  
    },  
    {  
      "id": 123,  
      "name": "Palm Jumeirah",  
      "path\_name": "Dubai \> Palm Jumeirah"  
    }  
  \]  
}

#### **Step B: Store the Mapping in your CRM**

Create a table in your CRM database called pf\_locations.  
| id (Primary Key) | name | full\_path |  
| :--- | :--- | :--- |  
| 50 | Dubai Marina | Dubai \> Dubai Marina |  
| 123 | Palm Jumeirah | Dubai \> Palm Jumeirah |

### ---

**3\. The Display Logic (How to show it)**

When you fetch a property from Property Finder, follow this logic in your code:

1. Get the locationId from the property data (e.g., 50).  
2. **Check Local Database:** Search your pf\_locations table for ID 50\.  
3. **Result Found:** Display "Dubai Marina".  
4. **Result Missing:** If the ID isn't in your table, trigger a "Real-time Lookup" call to GET /v1/locations?search={id} and then save that new location to your table automatically.

### ---

**4\. Checklist for "Missing Locations"**

If some properties show locations and others don't, it is usually because:

* **New Communities:** Property Finder adds new buildings/areas frequently. If your CRM doesn't have the new ID in its database, it shows as blank.  
* **Search vs. Detail:** The GET /v1/listings (Search) endpoint usually only gives the ID. The GET /v1/listings/{id} (Single Detail) endpoint *might* include the name object, but you should not rely on it. Always use the ID-to-Name mapping.

### ---

**5\. Developer "Copy-Paste" Logic**

Tell your developer to use this logic when a listing is fetched:

JavaScript

async function getFullLocationName(locationId) {  
    // 1\. Try to find the name in your own CRM database first (FAST)  
    let localName \= await db.query("SELECT name FROM pf\_locations WHERE id \= ?", \[locationId\]);  
      
    if (localName) {  
        return localName;  
    } else {  
        // 2\. If missing, ask Property Finder for the name (SLOW)  
        const response \= await fetch(\`https://api.propertyfinder.net/v1/locations?search=${locationId}\`);  
        const data \= await response.json();  
        const newLocation \= data.data\[0\];

        // 3\. Save it for next time  
        await db.execute("INSERT INTO pf\_locations (id, name) VALUES (?, ?)", \[newLocation.id, newLocation.name\]);  
          
        return newLocation.name;  
    }  
}

