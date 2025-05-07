const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

describe('Inventory Management E2E Tests', () => {
  let driver;

  beforeAll(async () => {
    // Set up Chrome options
    const options = new chrome.Options();
    options.addArguments('--headless'); // Run in headless mode
    options.addArguments('--no-sandbox');
    options.addArguments('--disable-dev-shm-usage');

    // Create driver
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();
  });

  afterAll(async () => {
    // Quit driver
    if (driver) {
      await driver.quit();
    }
  });

  beforeEach(async () => {
    // Navigate to the inventory page before each test
    await driver.get(`${process.env.FRONTEND_URL}/inventory`);
  });

  test('should display inventory page title', async () => {
    const title = await driver.getTitle();
    expect(title).toContain('Inventory Management');
  });

  test('should add a new part to inventory', async () => {
    // Click add part button
    const addButton = await driver.findElement(By.id('add-part-button'));
    await addButton.click();

    // Fill in part details
    await driver.findElement(By.id('part-name')).sendKeys('Test Part');
    await driver.findElement(By.id('part-quantity')).sendKeys('10');
    await driver.findElement(By.id('part-price')).sendKeys('99.99');

    // Submit form
    const submitButton = await driver.findElement(By.id('submit-part-button'));
    await submitButton.click();

    // Wait for success message
    const successMessage = await driver.wait(
      until.elementLocated(By.className('success-message')),
      5000
    );
    const messageText = await successMessage.getText();
    expect(messageText).toContain('Part added successfully');
  });
}); 