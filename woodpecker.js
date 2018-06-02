const puppeteer = require('puppeteer');
const creds = require('./creds');
const fs = require('fs');

async function woodpecker() {
  const BIRDFEED_SIGNIN = 'https://birdfeed.dirtybirdrecords.com/users/sign_in';
  const BIRDFEED_HOME = 'https://birdfeed.dirtybirdrecords.com/feed';
  const SIGNIN_SELECTOR = '#navbar > ul > li:nth-child(4) > a';
  const USERNAME_SELECTOR = '#user_email';
  const PASSWORD_SELECTOR = '#user_password';
  const LOGIN_SELECTOR = '#new_user > div:nth-child(7) > input'
  const BLURB_SELECTOR = 'div.blurb-image'
  const DOWNLOAD_BUTTON_SELECTOR = 'button[data-target="#release-download"]';
  const FLAC_DOWNLOAD_BUTTON_SELECTOR = '#release-download > a';
  const PAGE_CONTAINER_SELECTOR = 'body > div:nth-child(7) > div > div.col-md-9 > ul > li > a';

  const login = async () => {
    await page.goto(BIRDFEED_SIGNIN);
    await page.click(USERNAME_SELECTOR);
    await page.keyboard.type(creds.username);
    await page.click(PASSWORD_SELECTOR);
    await page.keyboard.type(creds.password);
    const navigationPromise = page.waitForNavigation();
    await page.click(LOGIN_SELECTOR);
    await navigationPromise;
  };

  const getFlacURL = (FLAC_DOWNLOAD_BUTTON_SELECTOR) => {
    const links = Array.from(document.querySelectorAll(FLAC_DOWNLOAD_BUTTON_SELECTOR));
    return links.reduce((filtered, link) => {
      if (link.href.includes('flac')) filtered.push(link.href);
      return filtered;
    }, []);
  };

  const downloadFile = async () => {
    await page._client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: `${__dirname}/releases`
    });
    await page.click(FLAC_DOWNLOAD_BUTTON_SELECTOR);
  }

  const goToBlurbPage = async (link, FLAC_DOWNLOAD_BUTTON_SELECTOR) => {
    const navigationPromise = page.waitForNavigation();
    await page.goto(link);
    await navigationPromise;
    await page.click(DOWNLOAD_BUTTON_SELECTOR);
    await downloadFile();
  };

  const getBlurbLinks = (BLURB_SELECTOR) => {
    const blurbs = Array.from(document.querySelectorAll(BLURB_SELECTOR));
    console.log(blurbs);
    return blurbs.reduce((filtered, blurb) => {
      if (blurb.children[0].href.includes('releases')) filtered.push(blurb.children[0].href);
      return filtered;
    }, []);
  };

  const getBlurbsOnPage = async () => {
    const blurbLinks = await page.evaluate(getBlurbLinks, BLURB_SELECTOR);
    for (const blurb of blurbLinks) {
      await goToBlurbPage(blurb, FLAC_DOWNLOAD_BUTTON_SELECTOR);
    }
    return blurbLinks;
  };

  const browser = await puppeteer.launch({
    headless: false,
  });
  const page = await browser.newPage();

  await login();
  let pageHasBlurbs = true;
  let pageNumber = 1;
  let flacLinks = [];
  while (pageHasBlurbs) {
    try {
      const navigationPromise = page.waitForNavigation();
      await page.goto(`https://birdfeed.dirtybirdrecords.com/feed?page=${pageNumber}`);
      await navigationPromise;
      console.log(`**** Getting links on: ${page.url()} ****`);
      const linksToAdd = await getBlurbsOnPage();
      linksToAdd.length === 0 ? pageHasBlurbs = false : flacLinks = [...flacLinks, ...linksToAdd];
      pageNumber++;
    } catch (e) {
      console.log(e);
    }
  }
  const areDownloadsFinshed = (cb) => {
    const int = setInterval(() => {
      console.log('**** DOWNLOADING FILES ****');
      let numFilesLeft = fs.readdirSync(`${__dirname}/releases`)
        .filter(fileName => fileName.includes('crdownload'))
        .length;
      console.log(`Completed: ${flacLinks.length - numFilesLeft}/${flacLinks.length}`)
      if (numFilesLeft === 0) {
        clearInterval(int);
        cb();
      }
    }, 5000);
  }

  areDownloadsFinshed(() => {
    browser.close();
    process.exit();
  })
};

woodpecker();
