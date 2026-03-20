Scarborough Ethnic Grocery Store Map
Developed for the Scarborough Environmental Association (SEA)

Overview

This project is a web-based interactive map showing ethnic grocery stores in Scarborough.
The map is built using Leaflet.js and loads store locations from a GeoJSON dataset.

The map is designed to run as a static webpage, meaning it can be hosted on any standard web server without additional software.

File Structure
--index.html
Main webpage that loads the map.


--data/

Contains the store dataset in GeoJSON format.

Example:

data/scarborough_grocery_stores.geojson


--js/

Javascript controlling the map behavior and popups.


--styles/

CSS styling for the map.


--icons/

Marker icons used for the different cuisines/regions.


Hosting the Map

To host the map:

-Upload the entire folder to the website server

-Ensure the folder structure is preserved

-Open:

/folder-name/index.html


Example:

https://example.org/scarborough-grocery-map/

No server-side software is required.

Updating the Dataset

The store locations are stored in:

data/ethnic-grocery.geojson


Technologies Used

Leaflet.js
OpenStreetMap basemap
GeoJSON spatial data

Contact

For questions about the map or dataset, please contact:

Christopher Hoornaert
cj.hoornaert@gmail.com
(Project developer)