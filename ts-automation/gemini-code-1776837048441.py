import asyncio
import os
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        user_data_dir = r"F:\Python\Projects\FlowAutomation\ts-automation\user_data"
        
        # Folder create karna agar nahi hai
        if not os.path.exists(user_data_dir):
            os.makedirs(user_data_dir)

        print("Launching browser... Please wait.")
        
        try:
            # Persistent context with stability arguments
            context = await p.chromium.launch_persistent_context(
                user_data_dir,
                headless=False,
                args=[
                    "--no-sandbox", 
                    "--disable-setuid-sandbox",
                    "--disable-extensions", # Extensions crash kar sakti hain shuru mein
                    "--start-maximized"
                ],
                no_viewport=True # Window size fix karne ke liye
            )
            
            page = context.pages[0] if context.pages else await context.new_page()
            await page.goto("https://www.google.com", wait_until="domcontentloaded")
            
            print("\n✅ Success! Browser is open and paused.")
            
            # Pause the script here
            await asyncio.get_event_loop().run_in_executor(None, input, "Press ENTER to close...")
            
            await context.close()
            
        except Exception as e:
            print(f"\n❌ Error occurred: {e}")
            print("\nTIP: Make sure NO other Chrome windows are using the 'user_data' folder.")

if __name__ == "__main__":
    asyncio.run(run())