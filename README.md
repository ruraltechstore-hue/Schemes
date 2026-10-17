# Scheme Compass

Build a modern, responsive web application called **Government Scheme Finder** that helps users discover government schemes they may be eligible for based on their profile and uploaded documents.

### 1. Landing Page

Create a professional homepage with:

* Hero: **“Find Government Schemes You May Be Eligible For”**
* Short explanation of the platform
* **Get Started** and **Login** buttons
* “How It Works”: Register → Upload Documents → Check Eligibility → View Schemes

### 2. Authentication

Create:

* Login page
* Registration page
* Forgot Password
* Logout

Registration fields:

* Name
* Email
* Mobile
* Password
* State
* District

### 3. User Dashboard

After login, show:

* Welcome message
* Profile completion
* Number of uploaded documents
* Number of matching schemes
* **Upload Documents** button
* **Check Eligibility** button

Dashboard navigation:

* Dashboard
* My Profile
* My Documents
* Eligible Schemes
* All Schemes
* Applications
* Settings
* Logout

### 4. User Profile

Collect information required for scheme matching:

* Date of Birth
* Gender
* State/District
* Category
* Annual Income
* Occupation
* Family Size
* Farmer/Student status
* Disability status
* Rural/Urban status

Allow users to edit their information.

### 5. Document Upload

Create a **My Documents** section where users can upload:

* Aadhaar
* PAN
* Income Certificate
* Caste Certificate
* Residence Certificate
* Land Documents
* Education Certificates
* Bank Documents
* Other Documents

Support PDF, JPG, JPEG and PNG.

Show uploaded documents with:

* Document name
* Type
* Upload date
* Processing status
* View/Delete buttons

Keep documents private and accessible only to the logged-in user.

### 6. Scheme Matching

Create a scheme database containing:

* Scheme name
* Description
* Department/Ministry
* Category
* Benefits
* Eligibility criteria
* Required documents
* Official application URL

Compare the user's profile/document information against eligibility rules and show:

**“Schemes You May Be Eligible For”**

Each scheme card should show:

* Scheme name
* Benefits
* Match percentage
* Why the user matches
* Missing requirements/documents
* **View Details**
* **Apply Now**

Use wording like **“You may be eligible”**, not guaranteed eligibility.

### 7. All Schemes

Create a searchable and filterable page for all schemes.

Filters:

* Agriculture
* Education
* Healthcare
* Employment
* Women
* Housing
* Business
* Rural Development
* Social Welfare
* Central/State Government

### 8. Applications

Allow users to track schemes they are interested in or have applied for.

Statuses:

* Interested
* Planning to Apply
* Applied
* Approved
* Rejected

### 9. Admin Dashboard

Create an admin panel to:

* Add/edit/delete schemes
* Add eligibility criteria
* Add required documents
* Add official application URLs

### 10. Design

Use a clean, trustworthy government-service-style UI with:

* Responsive design
* Sidebar dashboard
* Cards
* Search and filters
* Progress indicators
* Simple icons
* Mobile support

Use a database and authentication so the application is functional, not just a static UI.

Add a disclaimer:

**“Scheme recommendations are based on the information provided by the user. Final eligibility is determined by the concerned government department. Always verify the latest information on the official government website.”**

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/fc606815-78e1-43ed-841c-c495b0e48e56).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
