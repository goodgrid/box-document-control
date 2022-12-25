# Box Document Control (powered by Okta)

## Introduction
The aim of this project is to implement docunent control for ISO27001/ISO27002, ETSI certified businesses. In those kind of organizations, documents need to be reviewed and updated on a regular interval. This node.js script is scheduled to run montly and searches for documents that are set to expire in the next calendar month. The expiration date and the responsible owning role are set on the document in a metadata instance.

The owning role is looked up in Okta to translate to individual users. These users will be the assignees of a Box task on the document.


## Requirements to Box configuration

- Definition of a custom app with JWT server validation. The application needs read access in the repository and also write permissions to be able to start tasks. The application *user* needs appropiate permissions on the documents that need to be found and have tasks created for. 
- Metadata template (technically) named 'documentControl' with at least a date property called 'expirationDate' and a text property called 'ownership'.


## Requirements to Okta comnfiguration

- An API Access token tight to a user account with permissions to lookup users. 
- A custom profile property with the organization role. The technical name of the property is configurud in this projects config.


