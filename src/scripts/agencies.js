// Single source of truth for the agencies explorer.astro's dropdown exposes. Shared with
// nwk_view.astro so the hero preview only ever samples datasets the explorer can also reach.
export const AGENCIES = [
  { value: "Environmental_Protection_Agency", label: "Environmental Protection Agency" },
  { value: "US_Fish_&_Wildlife_Service", label: "US Fish & Wildlife Service" },
  { value: "Forest_Service", label: "Forest Service" },
  { value: "Army_Corps_of_Engineers", label: "Army Corps of Engineers" },
  { value: "National_Oceanic_&_Atmospheric_Admin", label: "National Oceanic & Atmospheric Admin" },
  { value: "Dept_of_Energy", label: "Dept of Energy" },
  { value: "US_Geological_Survey", label: "US Geological Survey" },
  { value: "National_Park_Service", label: "National Park Service" },
  { value: "Bureau_of_Reclamation", label: "Bureau of Reclamation" },
  { value: "Bureau_of_Land_Management", label: "Bureau of Land Management" },
  { value: "Nuclear_Regulatory_Commission", label: "Nuclear Regulatory Commission" },
  { value: "Minerals_Management_Service", label: "Minerals Management Service" },
];

// "All agencies" is a real dropdown option, but it points at a separate x_agy data folder
// rather than one of the per-agency files above, so it's kept out of the AGENCIES list itself.
export const ALL_AGENCIES_VALUE = "x_agy";
