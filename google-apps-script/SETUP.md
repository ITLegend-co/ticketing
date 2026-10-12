# Mountain Torq IT Helpdesk — Google Drive photos

The website feature is prepared but stays unavailable until the Apps Script URL is configured and tested. No Firebase service account or password is needed.

## 1. Apply Firebase rules

Open Firebase project **ticketing-a8461 → Realtime Database → Rules**. Copy the entire `database.rules.json` from this repository into the Rules editor and click **Publish**. This is the previously pending request-review rules update. Do not paste the rules into the Data tab.

## 2. Restrict the Drive folder

Open the folder **Ticket attachement** (`1aeiNJpRVmMijmhR7iaCIOA7Qj5BQv7c4`). In **Share → General access**, choose **Restricted**. Do not share the folder directly with normal users. The website will check Firebase sign-in and request ownership before providing photos. Use a Google account that owns the folder or can add files to it for the next step.

## 3. Deploy the attachment service

1. Open https://script.google.com/ and choose **New project**.
2. Name it **Mountain Torq Helpdesk Attachments**.
3. Replace everything in **Code.gs** with this repository's `google-apps-script/Code.gs`.
4. Save, then choose **Deploy → New deployment → Web app**.
5. Set **Execute as: Me** and **Who has access: Anyone**. The endpoint is reachable by the website, but every upload and download verifies a Firebase token and ticket permissions. The folder and photos remain private.
6. Click **Deploy** and authorize the requested Drive and external-request permissions with the Google account that can write to the folder. Only proceed through Google's verification screen if this is the script you just created from this repository.
7. Copy the **Web app URL**, ending in `/exec`, and send that URL in chat. Do not send passwords, OAuth tokens, or service-account keys.

If your Workspace policy does not offer **Anyone**, report that limitation instead of changing organization security settings.

## 4. Connect and test

The web app URL must be placed in `src/drive-config.json` and deployed to GitHub Pages. Once the URL is supplied, the connection can be checked end to end. A live test is still needed to confirm Google deployment permissions and cross-origin responses.

Create a request, open its details, and use **Add photos**. Supported formats: JPG, PNG, and WebP, up to 5 photos per request and 5 MB each. The default limits can be changed later. Uploaded photos are placed in a `request-<ticket ID>` subfolder. After changing Apps Script code later, use **Deploy → Manage deployments → Edit → New version** to update the existing deployment.

## Access

- IT Admin: view and upload on any request.
- Management: view any request.
- IT Technician: view/upload on reviewed requests assigned to them, and their own requests.
- Normal staff: view/upload only on their own requests.

There are no public Drive links or stored user passwords. Firebase ID tokens are sent only in the HTTPS POST body to the deployed Google script; the script validates them and never returns the Google owner's OAuth token.
