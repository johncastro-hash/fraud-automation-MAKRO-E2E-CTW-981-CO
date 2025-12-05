import "dotenv/config";
import { Stagehand } from "@browserbasehq/stagehand";

// --- START: CONFIGURATION ---
const LOGIN_URL = "https://zombie-app.zubale.com/";
const TARGET_TASK_URL = "https://zombie-app.zubale.com/submissions/new";

// Read credentials and brand from .env file
const USERNAME = process.env.ZUBALE_USERNAME; // e.g., "john.castro@zubale.com"
const PASSWORD = process.env.ZUBALE_PASSWORD; // e.g., "Vv%H?}XvU~H**3E3V:"
const BRAND = process.env.ZUBALE_BRAND; 

// Extractor variables (from your .env file)
const COL_HEADER = process.env.TARGET_COLUMN_HEADER; // e.g., "captura"
const ROW_KEY = process.env.TARGET_ROW_KEY;         // e.g., "NÚMERO"
const EVIDENCE_KEY = process.env.EVIDENCE_TO_CHECK; // e.g., "Captura una foto del 'comprobante' de compra"
// --- END: CONFIGURATION ---

async function main() {
  if (!USERNAME || !PASSWORD || !BRAND || !COL_HEADER || !ROW_KEY || !EVIDENCE_KEY) { 
    console.error("❌ ERROR: Required configuration variables are missing in the .env file!");
    process.exit(1);
  }

  const stagehand = new Stagehand({
    env: "LOCAL",
    model: "google/gemini-2.5-flash", 
  });

  try {
    await stagehand.init();
    const page = stagehand.context.pages()[0];

    // --- 1. & 2. Login Steps ---
    console.log('Stagehand Session Started');
    console.log(`\n--- 1. Logging in as ${USERNAME} ---`);
    await page.goto(LOGIN_URL);

    console.log('Attempting login...');
    
    // STEP 1: Enter Username
    await stagehand.act(`Enter the username "${USERNAME}" into the email field.`, { timeout: 15000 });
    await new Promise(resolve => setTimeout(resolve, 1000)); 

    // STEP 2: Enter Password
    await stagehand.act(`Enter the password "${PASSWORD}" into the password field.`, { timeout: 15000 });
    await new Promise(resolve => setTimeout(resolve, 1000)); 

    // STEP 3: Click Login and wait for navigation
    await stagehand.act(`Click the Login button and wait for the dashboard to load.`, { timeout: 15000 });
    await new Promise(resolve => setTimeout(resolve, 5000)); 
    console.log('Login successful and dashboard loaded. Proceeding to task list.');
    // ---------------------------------------------------------------


    // --- 3. Initial Navigation & Filtering (AGENT 1 Setup) ---
    console.log(`\n--- 2. Initial Filter by BRAND ${BRAND} ---`);

    await page.goto(TARGET_TASK_URL);
    
    const agent1 = stagehand.agent({
      cua: true,
      model: "google/gemini-2.5-computer-use-preview-10-2025", 
      systemPrompt: "You are an expert browser navigator. Your goal is to apply the required filter and report the status.",
    });
    
    const initialFilterInstruction = `
      1. In the search bar labeled 'Brand', enter the text '${BRAND}'. 
      2. Click the 'Filter' button and wait for the results table to refresh.
      3. If the page shows 'No rows found', your final output must be the phrase: "no task pending to check".
      4. Otherwise, confirm the filter is applied by outputting "filter applied and tasks visible".
    `;
    
    const filterResult = await agent1.execute(initialFilterInstruction);
    
    console.log(`Filter Result: ${filterResult.message}`);

    if (filterResult.message.includes("no task pending to check")) {
      console.log(`\n--- FINAL AUDIT RESULT ---\nValidation Status: Task list is empty for brand ${BRAND}.\n--------------------------`);
      await stagehand.close();
      return;
    }
    
    // Wait for the list to fully stabilize before starting the loop
    await new Promise(resolve => setTimeout(resolve, 3000)); 

    // --- 4. Start the Batch Processing Loop ---
    let taskCount = 0;
    while (true) {
      taskCount++;
      console.log(`\n================= STARTING TASK ${taskCount} =================`);

      // --- 4a. Navigate to Task Detail (ACT) ---
      console.log("Attempting to scroll right...");

      try {
        // STEP 4a.1: Explicitly scroll the table container to reveal the VIEW button
        // Based on the log, the scrollable element is the submissions table itself.
        await stagehand.act("Scroll the submissions table horizontally to the far right. Use mouse movement or arrow keys if a scrollbar is not visible.", { timeout: 10000 });
        
        console.log("Scroll attempt complete. Attempting to click VIEW link...");

        // STEP 4a.2: Click the 'VIEW' link and wait for navigation
        // This action should trigger navigation to the detail page.
        await stagehand.act("Click the first 'VIEW' link or button in the list to open the task detail page.", { timeout: 15000 });
        

      } catch (error) {
        // If the 'VIEW' link cannot be found (e.g., list is empty), exit the loop.
        console.log("No more 'VIEW' links found or navigation failed. Exiting batch process.");
        break; // Exit the main loop gracefully
      }

      // Wait for the detail page to fully render
      await new Promise(resolve => setTimeout(resolve, 7000)); 

      // --- 4b. Audit and Validation (AGENT 2) ---
      console.log(`\n--- AGENT 2: Starting Validation Audit for Evidence: ${EVIDENCE_KEY} ---`);

      const agent2 = stagehand.agent({
        cua: true,
        model: "google/gemini-2.5-computer-use-preview-10-2025", 
        systemPrompt: "You are an expert data auditor. Your only goal is to perform the validation audit and return the conditional status.",
      });
      
      const validationInstruction = `
        You are currently on the task detail page. Your task is to perform a data audit using the following configuration:
        - Evidence Key to Click: '${EVIDENCE_KEY}'
        - Data Row to Extract From: '${ROW_KEY}'
        - Data Column to Extract From: '${COL_HEADER}'

        1. **Evidence Selection:** Locate the image/evidence thumbnails. Identify and **click the thumbnail** that is labeled with or corresponds to the Evidence Key: **'${EVIDENCE_KEY}'**. Wait for the main evidence image to fully load in the viewer.
        
        2. **Evidence Inspection:** Ensure the key text, specifically the 'Numero pedido' or equivalent field, is fully visible and legible in the evidence viewer. You may need to **zoom out ('-')** to see the whole receipt or **scroll/pan** the image within its viewer to bring the necessary text into focus.

        3. **Value Extraction:** Navigate to the data table section (Live Tracking). Find the cell at the intersection of the **row labeled '${ROW_KEY}'** and the **column labeled '${COL_HEADER}'**. Extract the value from this cell. Let this be **[RAW\_VALUE]**.
        
        4. **Data Cleaning & Normalization:** The target code is always a **10-character alphanumeric string**. Clean the [RAW\_VALUE] to isolate this target code.
           * **A.** Remove any double-hyphen suffix and everything that follows it (e.g., '83V1EAXU76--1' becomes '83V1EAXU76').
           * **B.** Remove any single-hyphen prefix and everything that precedes it (e.g., 'L-83V1EAXU76' becomes '83V1EAXU76').
           * The result of this cleaning is the **[CLEANED\_VALUE]**.
        
        5. **Validation Audit:** Inspect the loaded main evidence image (the receipt/document). Search the text within the evidence image for the presence of the **[CLEANED\_VALUE]**. **Specifically, check the text labeled "Numero pedido" or a similar "Order/Reference/Receipt Number" field in the receipt.**
        
        6. **Final Output (Conditional):**
           * **If** [CLEANED\_VALUE] is found in the evidence image: return the text **"[CLEANED\_VALUE] value found"**.
           * **If** [CLEANED\_VALUE] is NOT found in the evidence image: return the text **"[CLEANED\_VALUE] value not found in the evidence"**.
           
        The final output must strictly follow one of these two formats.
      `;

      const validationResult = await agent2.execute(validationInstruction);
      const status = validationResult.message;
      
      console.log(`\n--- Task ${taskCount} Audit Result ---`);
      console.log(`Validation Status: ${status}`);

      // --- 4c. Conditional Action (Approve or Exit) ---
      if (status.includes("value found")) {
        // SUCCESS PATH: Approve the task
        console.log("MATCH FOUND! Approving task and returning to list...");

        // Click the Approve button
        await stagehand.act("Click the 'Approve (A)' button, which is usually green or marked with an 'A'.");

        // Wait for the page to fully reload back to the list view after approval
        await new Promise(resolve => setTimeout(resolve, 8000));
        // Loop continues to the next task

      } else if (status.includes("not found")) {
        // FAILURE PATH: Extract the value and exit
        const match = status.match(/\[(.*?)\] value not found/);
        const valueToReport = match ? match[1] : 'UNKNOWN_VALUE';

        console.log(`\nMISMATCH DETECTED: Terminating batch process.`);
        console.log(`Final required message: value ${valueToReport} not found`);
        break; // Exit the main loop
      } else {
        // Unexpected or ambiguous result from the agent
        console.warn(`Unexpected validation result: ${status}. Terminating loop to prevent infinite run.`);
        break;
      }
    } // End of while (true) loop

  } catch (error) {
    console.error('An unhandled error occurred during the automation:', error);
  } finally {
    await stagehand.close();
    console.log('\nStagehand Session Closed.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});