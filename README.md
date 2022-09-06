# Box Document Control (powered by Okta)

The aim of this project is to implement docunent control for ISO27001/ISO27002, ETSI certified businesses. In those kind of organizations, documents need to be reviewed and updates on a regular interval. This node.js script is scheduled to run montly and searched for documents that are set to expire in the coming calendar month. The expiration date and the responsible owning role are set on the document as a metadata instance.

The owning role is looked up in Okta to translate to individual users. These users will be the assignees of a Box task on the document.
