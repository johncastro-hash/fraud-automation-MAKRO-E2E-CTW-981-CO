🤖 Stagehand Automation Script - Zubale Task reviewer

Overview

This project is a TypeScript automation script built using the Stagehand framework. Its primary function is to continuously monitor and process tasks within the Zubale administrative dashboard ("Zombie") by applying specific filters, navigating to new task submissions, validating task responses using contextual information (provided by a large language model), and executing necessary approval or exit actions.

The script is designed to run in a continuous loop, ensuring real-time processing of new submissions.

Prerequisites

To run this project locally, you must have the following installed:

Node.js (version 18 or higher)

TypeScript and ts-node (installed globally or locally via npm install)

Required Environment Variables (see Configuration section below)

Local Setup and Installation

Clone the Repository (If setting up on a new machine):

git clone [https://github.com/your-username/your-repo-name.git](https://github.com/your-username/your-repo-name.git)
cd your-repo-name


Install Dependencies:

npm install


This installs Stagehand and other necessary libraries defined in package.json.

Configuration: Create a file named .env in the root of your project directory. This file holds your credentials and application settings. It is ignored by Git to protect your secrets.

The .env file should contain:

# --- Required Credentials ---
ZUBALE_USER="YOUR_ZUBALE_EMAIL"
ZUBALE_PASSWORD="YOUR_ZUBALE_PASSWORD"
ANTHROPIC_API_KEY="YOUR_ANTHROPIC_API_KEY" # Used for the Agent model

# --- Script Specific Configuration ---
TARGET_TASK_URL="[https://zombie.app.zubale.com/submissions/new](https://zombie.app.zubale.com/submissions/new)"
ZUBALE_BRAND="MAKRO E2E CTW"
TARGET_COLUMN_HEADER="captura"
TARGET_ROW_KEY="NÚMERO"
EVIDENCE_TO_CHECK="Captura una foto del 'comprobante' de compra"
# ... add any other specific environment variables used in index.ts


How to Run the Script

To run the script and start the automation loop, execute the following command in your terminal:

ts-node index.ts


The script will:

Log in to the Zubale dashboard.

Apply the brand filter specified by ZUBALE_BRAND.

Start the continuous processing loop.

Project Structure

index.ts: The main TypeScript file containing the Stagehand login sequence, the filtering logic, the continuous task processing loop, and the LLM Agents (Agent 1 for navigation, Agent 2 for validation).

.env: Local configuration file (ignored by Git).

package.json: Lists project dependencies.

.gitignore: Specifies files and directories to exclude from the Git repository (e.g., node_modules, .env).
