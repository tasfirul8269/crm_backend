export class CreateTenancyContractDto {
    propertyId?: string;

    // Owner Details
    ownerName?: string;
    ownerPhone?: string;
    ownerEmail?: string;

    // Tenant Details
    tenantName?: string;
    tenantPhone?: string;
    tenantEmail?: string;

    // Property Details
    propertyUsage?: string;
    buildingName?: string;
    location?: string;
    propertySize?: number;
    propertyType?: string;
    propertyNumber?: string;
    plotNumber?: string;
    premisesNumber?: string;

    // Contract Details
    contractStartDate?: string; // ISO Date
    contractEndDate?: string; // ISO Date
    annualRent?: number;
    contractValue?: number;
    securityDeposit?: number;
    modeOfPayment?: string;

    // Additional Terms
    additionalTerms?: string[];
}
