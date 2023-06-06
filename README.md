# StashApp Performer & Background Image Plugin
Are you bored looking at the _same exact image_ of each of your performers every time you browse content?

This is a custom StashApp JavaScript plugin for setting different images for performers with randomization and presets as well as full-page background images to the UI.

### What is this?
A workaround for StashApp only supporting single performer images. With the addition of custom Javascript support,  I hacked together a solution using tagging and galleries to cache images in the browser's IndexedDB and swap `src` attributes during render.

You can...
1. Set lots of different performer images with presets and randomization
2. Display full-page, reduced opacity background images to show beneath all page content

By applying a series of galleries and tags to your content, the script will build an IndexedDB in the browser using GraphQL calls to retrieve and cache images. Using MutationObserver, the script watches for performer image nodes to be rendered and swaps `src` attributes using what is stored in the IndexedDB.

### Why?
Because I wanted extra eye candy. I get sick of looking at the same image of each performer. I like randomization. Sometimes in a "mood" where I want fully-clothed posters for each performer (preset). I also like full-page background images to make loading screens, etc more exciting. This is also a total hack job that has evolved over time from Tampermonkey ...and I can't actually maintain something in the actual StashApp codebase.

## Global Setup
I use a modified version of the Plex theme. Your chosen theme may not look good with the full-page background images. The rest of the performer image functionality _should_ work fine for any theme. 

1. Open StashApp and navigate to `settings > interface`
2. Enable "Custom Javascript"
3. Paste the contents of the script into the text editor when editing "Custom Javascript"
4. Inside of the pasted script, replace the `SERVER_URL` variable at the top with the correct address for your StashApp server
4. Enable "Custom CSS"
5. Add the following rules to the text editor when editing "Custom CSS"

```
/* Do not set. This variable is changed programatically for background images */
:root {
  --background-image: url('');
}

/* Injects background image into the #root node */
#root:before {
  position: fixed;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
  background-image: var(--background-image);
  background-size: cover;
  background-position: center 10%;
  opacity: 0.3;
  content: '';
  z-index: -1;
}

/* Positions preset select box in top right nav */
#poster-select {
    width: 96px;
    color: #fff;;
    border: none;
    border-radius: 4px;
    height: calc(1.5em + 2px + 0.75rem);
    background: rgba(10, 25, 30, 0.62);
    line-height: 2.6;
    padding: 0 8px;
    transform: translateX(-16px);
}
```

## Background Images
Primary background images are full-page photos with reduced opacity placed onto the `#root` of each page. These are photos pulled from a StashApp gallery you must create and one photo from the gallery will be pulled randomly and displayed on initial full-page refresh (not in-app navigation).

> Background images display on all pages **except** individual performer pages

#### Setup

1. Create a new StashApp gallery (name whatever you like)
2. Find the ID for the created gallery. This can most easily be found in the URL when viewing the gallery:<br>
**Example URL**: `http://127.0.0.1:9999/galleries/324` = **324** is the gallery ID.
3. Open the script in the "Custom Javascript" settings and update the `BACKGROUND_GALLERY_ID` at the top of the page.


Once images are added to the gallery and populated in the IndexedDB, a random image will display on page load.

[Example Image](https://raw.githubusercontent.com/ed36080666/stashapp_performer_image_plugin/main/_assets/background_image_example.jpg)


## Performer Images
Performer image overrides use tags and galleries to support multiple performer images using randomization and presets. This is done by watching for page changes and quickly retrieving a cached image from the IndexedDB and swapping the `src` for each image of the performer on every page (cards, popovers, etc.).

> The actual performer image set in StashApp is never changed, the `src` is swapped out during render.

To swap between performer image defaults, presets, and randomization, this script injects a select at the top right corner of the nav bar. You will need to map options in this select with the tag IDs you are using to manage your content. 

![image](https://raw.githubusercontent.com/ed36080666/stashapp_performer_image_plugin/main/_assets/select.JPG)

### Randomized Performer Images
Randomized performer images pulls photos from galleries and chooses a random one every time a performer image node is rendered. You will need to create a single gallery for each performer and apply a global tag you will define.

> Each performer has their own gallery of photos to display randomly. Performers must be set in StashApp UI appropriately.

#### Setup: Randomization

1. Create a new Tag that will be given to each performer image gallery you want to pull from (e.g. `[randomization_gallery]`).
2. Find the ID for the tag. ID can most easily be found in the URL when viewing the tag:<br>
**Example URL**: `http://192.168.50.202:9999/tags/1153` = **1153** is the Tag ID
3. Open the script in the "Custom Javascript" settings and update the `ROTATION_GALLERY_ID` variable to the tag ID
4. Create a gallery for a single performer. You **MUST** add the performer field and the tag to the _gallery_ entity you are creating.
5. Add photos and save the gallery.

> Each of my performers has their own "randomization gallery"

When "Random" is selected as the preset in  your select box, the script will lookup the associated gallery for each performer and pull a random image to display.

#### Setup: Presets

Presets are a way to set a specific and consistent "type" of photo for each performer (e.g. fully clothed, fully nude, wearing lingerie, c*** in mouth, etc.). Prests are defined by setting a specific tag on a photo and a mapping for the select box.

1. Create a new Tag that you will apply to each photo preset
2. Find the ID for the tag. ID can most easily be found in the URL when viewing the tag:<br>
Example URL: http://192.168.50.202:9999/tags/1153 = **1153** is the Tag ID
3. Open the script in the "Custom Javascript" settings and define the new Tag ID in the `PERFORMER_IMAGE_TAG_IDS` object:
```
const PERFORMER_IMAGE_TAG_IDS = {
    fully_clothed: 1153
    fully_nude: 1154
    // custom_name: TAG_ID
    // ...add new items. the name doesn't have to match tag name
}
```
4. Add an item to the select box UI pointing to the key you creating in the PERFORMER_IMAGE_TAG_IDS object
```
const SELECT_OPTIONS = {
    'Default': null,
    'Randomize': 'random',
    'Fully Nude': 'fully_nude',
    'Fully Clothed': 'fully_clothed',
     // ...add new items.
     // the key is name shown in select box UI. the value maps to PERFORMER_IMAGE_TAG_IDS key
};
```
5. Tag performer photos with your preset tags and they will be randomized when a preset is selected.

> Photos must also have the correct performer field set


#### Setup: Performer Background Images
Performer specific background images are full-page, reduced opacity background images that live only on individual performer pages. Basically it felt weird having the normal background photos displaying someone else as background when viewing another performers's page. These images work like the presets and utilize a tag.

**Setup**
1. Create a specific Tag for performer background images.
2. Find the ID for the tag. This can most easily be found in the URL when viewing the tag:<br>
**Example URL**: `http://192.168.50.202:9999/tags/1153` = 1153 is the Tag ID
3. Open the script in the "Custom Javascript" settings and update the `background` property of the `PERFORMER_IMAGE_TAG_IDS`

> You must set the id on the **`background`** property. Do not change this key name.

4. You do _not_ need to add anything to the select box for performer background images.


[Example Image](https://raw.githubusercontent.com/ed36080666/stashapp_performer_image_plugin/main/_assets/performer_background_image_example.jpg)