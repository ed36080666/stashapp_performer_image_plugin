// DEVELOPER TODO!
// 1. find a way to periodically refresh the DB (time based? user action?)
// 2. handle pagination for the GraphQL requests.
// 3. Randomization intervals


// CUSTOMIZE THESE VARIABLES FOR YOUR SERVER
const SERVER_URL = 'http://127.0.0.1:9999/graphql';
const ROTATION_GALLERY_ID = 266;    // todo
const BACKGROUND_GALLERY_ID = 251;  // todo
const SELECT_OPTIONS = {
    'Default': null,
    // declare options for preset select box. each option
    // maps to a key in the PERFORMER_IMAGE_TAG_IDS object
    // example: 'Modest': 'modest',
    //...
    'Randomize': 'random'
};
const PERFORMER_IMAGE_TAG_IDS = {
    // maps a Tag ID to a select option for performer presets. when a preset
    // is selected, performer images with matching Tag ID will display.
    // background: 1154
    // ...
};

// THESE DO NOT NEED CUSTOMIZED
const DB_VERSION = 1;
const DB_NAME = 'stash_posterPlugin';
const ACTIVE_SELECTION_STORAGE_KEY = 'stash_activeTagId';
let ACTIVE_BACKGROUND_URL = null;
let ACTIVE_PERFORMER_BACKGROUND_URL = null;
const PERFORMER_IMAGE_SELECTORS = {
    '.performer-card': {
        getImgNode: (node) => node.querySelector('.performer-card-image'),
        parseId: (node) => node.querySelector('a').getAttribute('href').replace('/performers/', ''),
        imageType: 'image'
    },
    '#popover .performer-tag-container': {
        getImgNode: (node) => node.querySelector('img'),
        parseId: (node) => node.querySelector('a').getAttribute('href').replace('/performers/', ''),
        imageType: 'thumbnail',
    }
};


window.addEventListener('load', async () => {
    console.log('[poster plugin]: Page loaded...');

    // todo find a way to not always do this. the select option doesn't seem to work...
    await refreshDb();

    // reference to current route checked on each mutation.
    // if route changes or popover shown, reset posters for the page.
    let CURRENT_ROUTE;

    const obs = new MutationObserver(async mutationList => {
        // don't run image change mutations when loading or if staying on the
        // same page and not being triggerd by a popover. this should mean
        // the image mutations only run once per unique page view.
        if (
            document.querySelector('.LoadingIndicator') ||
            (CURRENT_ROUTE === window.location.href && !document.querySelector('#popover .performer-tag-container'))
        ) {
            return;
        }

        CURRENT_ROUTE = window.location.href;

        setBackgroundImage();

        setImageNodes();
    });

    obs.observe(document.body, { subtree: true, childList: true });
    createSelect();
});

const setBackgroundImage = async () => {
    // when viewing performer page, show their own background or nothing.
    if (location.href.includes('/performers/')) {
        if (!ACTIVE_PERFORMER_BACKGROUND_URL) {
            const performerId = location.href.split('/')[4];
            const result = await getPerformerById(performerId);
            if (Array.isArray(result?.background)) {
                ACTIVE_PERFORMER_BACKGROUND_URL = result.background[Math.floor(Math.random() * result.background.length)].paths['image'];
            }
        }

        root.style.setProperty('--background-image', `url(${ACTIVE_PERFORMER_BACKGROUND_URL || ''})`);
    } else {
        ACTIVE_PERFORMER_BACKGROUND_URL = null;

        if (!ACTIVE_BACKGROUND_URL) {
            const image = await getRandomBackground();
            ACTIVE_BACKGROUND_URL = image.paths.image;
        }

        root.style.setProperty('--background-image', `url(${ACTIVE_BACKGROUND_URL || ''})`);
    }
};

const setImageNodes = () => {
    // set all of the performer images.
    Object.keys(PERFORMER_IMAGE_SELECTORS).forEach(selector => {
        document.querySelectorAll(selector).forEach(async node => {

            const performerId = PERFORMER_IMAGE_SELECTORS[selector].parseId(node);
            const imgNode = PERFORMER_IMAGE_SELECTORS[selector].getImgNode(node);

            // before overriding img node, set opacity to 0 to prevent the
            // default image from flashing before override loads in
            imgNode.style.transition = 'opacity 0.25s ease';
            imgNode.style.opacity = 0;

            await setNode(performerId, imgNode);

            // set opacity to visible
            setTimeout(() => {
                imgNode.style.opacity = 1;
            }, 100);
        });
    });
};

const setNode = async (performerId, imgNode, imgType = 'image') => {
    const result = await getPerformerById(performerId);

    if (result && imgNode) {
        const newImage = retrieveImage(result, imgType);
        if (newImage) {
            imgNode.src = newImage;
        }
    }

};

const retrieveImage = (record, imgType) => {
    const activeSelection = getStorage(ACTIVE_SELECTION_STORAGE_KEY);
    // if it is not a valid selection, do nothing.
    if (!Object.values(SELECT_OPTIONS).includes(activeSelection)) return null;

    if (activeSelection === 'random' && record.gallery) {
        return record.gallery[Math.floor((Math.random() * record.gallery.length))].paths[imgType];
    }

    if (Array.isArray(record[activeSelection])) {
        return record[activeSelection][Math.floor(Math.random() * record[activeSelection].length)].paths[imgType];
    }

    return record.image_path;
};

const getPerformerById = (id) => {
    return new Promise((resolve, reject) => {
        openDb((db) => {
            const transaction = db.transaction('performers', 'readonly');
            transaction.onerror = reject;

            const store = transaction.objectStore('performers');
            const response = store.get(id);
            response.onerror = reject;
            response.onsuccess = () => resolve(response.result ?? null);
        });
    });
};

const getRandomBackground = () => {
    return new Promise((resolve, reject) => {
        openDb((db) => {
            const transaction = db.transaction('backgroundImages', 'readonly');
            transaction.onerror = reject;

            const store = transaction.objectStore('backgroundImages');
            // https://www.raymondcamden.com/2014/11/30/Selecting-a-random-record-from-an-IndexedDB-Object-Store
            store.count().onsuccess = function (event) {
                const total = event.target.result;
                let needRandom = true;
                store.openCursor().onsuccess = function (e) {
                    const cursor = e.target.result;
                    if (needRandom) {
                        const advance = Math.floor(Math.random() * ((total - 1) - 0 + 1)) + 0; //getRandomInt(0, total - 1);
                        if (advance > 0) {
                            needRandom = false;
                            cursor.advance(advance);
                        } else {
                            resolve(cursor.value);
                        }
                    } else {
                        resolve(cursor.value);
                    }
                };
            };
        });
    });
};

const upsertDbRecord = (storeName, payload) => {
    return new Promise((resolve, reject) => {
        openDb((db) => {
            const transaction = db.transaction(storeName, 'readwrite');
            transaction.oncomplete = resolve;
            transaction.onerror = reject;

            const store = transaction.objectStore(storeName);
            store.onsuccess = resolve;
            store.put(payload);
        });
    });
};

const refreshDb = async () => {
    await refreshPerformerStore();
    await refreshBackgroundImageStore();
};

// query and insert all the background images into the IndexedDB store.
const refreshBackgroundImageStore = async () => {
    const response = await makeRequest(buildBackgroundGalleryRequest());
    response.data.findGallery.images.forEach(async image => {
        await upsertDbRecord('backgroundImages', image);
    });
}

// query and insert all the performer images into the IndexedDB store.
const refreshPerformerStore = async () => {
    const map = {};
    // query for performer images in associated gallery.
    const galleryResponse = await makeRequest(buildGalleryRequest());
    galleryResponse.data.findGalleries.galleries.forEach(gallery => {
        gallery.performers.forEach(performer => {
            map[performer.id] = {
                ...map[performer.id] || {},
                name: performer.name,
                performerId: performer.id,
                deafultImage: performer.image_path,
                gallery: [...map[performer.id]?.gallery || [], ...gallery.images]
            };
        });
    });

    // query for performer images with relevant tags
    const taggedImageResponse = await makeRequest(buildTaggedImagesRequest());
    taggedImageResponse.data.findImages.images.forEach(image => {
        image.performers.forEach(performer => {
            // ensure we are only pulling tags we are interested in.
            const tagIds = image.tags.filter(tag => Object.values(PERFORMER_IMAGE_TAG_IDS).includes(parseInt(tag.id)))
                .map(tag => tag.id);

            // build up a key named for the tag on the object containing an array of all matched images.
            tagIds.forEach(id => {
                // find the matching key name for our id from the global map
                const key = Object.entries(PERFORMER_IMAGE_TAG_IDS).find(([key, val] = entry) => val == id)[0];
                map[performer.id] = {
                    ...map[performer.id] || {},
                    name: performer.name,
                    performerId: performer.id,
                    [key]: [...(map[performer.id]?.[key] || []), { paths: image.paths, id: image.id }]
                }
            });
        });
    });

    // use the map to insert performer records to db
    Object.values(map).forEach(async item => {
        await upsertDbRecord('performers', item);
    });
}

const openDb = (callback = Function.prototype) => {
    let handle = indexedDB.open(DB_NAME, DB_VERSION);

    handle.onupgradeneeded = () => {
        const db = handle.result;
        console.log(db.objectStoreNames);
        if (!db.objectStoreNames.contains(DB_NAME)) {
            console.log('[poster plugin]: Creating new IndexedDB...');
            db.createObjectStore('performers', {
                keyPath: 'performerId'
            });

            db.createObjectStore('backgroundImages', {
                keyPath: 'id'
            });
        }
    };

    handle.onerror = () => {
        console.error('[poster plugin]: Error opening IndexedDB.', handle.error);
    };

    handle.onsuccess = () => {
        let db = handle.result;
        callback(db);
    };
};

const buildGalleryRequest = () => {
    const galleryQuery = `
    query FindGalleries($filter: FindFilterType, $gallery_filter: GalleryFilterType) {
      findGalleries(gallery_filter: $gallery_filter, filter: $filter) {
        count
        galleries {
          id
          title
          image_count
          images {
            id
            paths {
              thumbnail
              image
            }
          }
          performers {
            id
            name
            image_path
          }
        }
      }
    }
  `;

    // todo how to handle pagination?
    return {
        operationName: 'FindGalleries',
        query: galleryQuery,
        variables: {
            filter: {
                direction: 'ASC',
                page: 1,
                per_page: 10000,
            },
            gallery_filter: {
                tags: {
                    depth: 0,
                    modifier: 'INCLUDES_ALL',
                    value: [ROTATION_GALLERY_ID]
                },
            }
        },
    };
};

const buildTaggedImagesRequest = () => {
    const imageQuery = `
    query FindImages($filter: FindFilterType, $image_filter: ImageFilterType, $image_ids: [Int!]) {
      findImages(filter: $filter, image_filter: $image_filter, image_ids: $image_ids) {
        images {
          id
          paths {
            thumbnail
            image
          }
          tags {
            id
            name
          }
          performers {
            id
            name
          }
        } 
      }
    }
  `

    // todo pagination?
    return {
        operationName: 'FindImages',
        query: imageQuery,
        variables: {
            filter: {
                direction: "ASC",
                page: 1,
                per_page: 10000,
            },
            image_filter: {
                tags: {
                    depth: 0,
                    modifier: 'INCLUDES',
                    value: Object.values(PERFORMER_IMAGE_TAG_IDS)
                }
            }
        }
    };
};

const buildBackgroundGalleryRequest = () => {
    const query = `
    query FindGallery($id: ID!) {
      findGallery(id: $id) {
        id
        title
        url
        images {
          id
          paths {
            thumbnail
            image
          }
        }
        __typename
      }
    }
  `

    // todo pagination?
    return {
        operationName: 'FindGallery',
        query: query,
        variables: {
            id: BACKGROUND_GALLERY_ID
        }
    };
};

const makeRequest = async (payload) => {
    const response = await fetch(SERVER_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        redirect: 'follow',
        body: JSON.stringify(payload)
    });

    return response.json();
};

const getStorage = (storageKey) => {
    return JSON.parse(localStorage.getItem(storageKey));
};

const setStorage = (storageKey, value) => {
    localStorage.setItem(storageKey, JSON.stringify(value));
};

const createSelect = () => {
    const select = document.createElement('select');
    select.id = 'poster-select';

    const currentSelection = getStorage(ACTIVE_SELECTION_STORAGE_KEY);
    for (const key in SELECT_OPTIONS) {
        const option = document.createElement('option');
        option.value = SELECT_OPTIONS[key];
        option.text = key;
        option.selected = currentSelection == SELECT_OPTIONS[key] ? 'selected' : ''
        select.appendChild(option);
    }

    // add management options
    const refreshOption = document.createElement('option');
    refreshOption.value = 'refresh-db';
    refreshOption.text = '[refresh DB]';
    select.appendChild(refreshOption);


    select.addEventListener('change', (e) => {
        if (e.target?.value === 'refresh-db') {
            confirmRefreshDb();
            return;
        }

        const val = e.target.value === 'null' ? null : e.target.value;

        setStorage(ACTIVE_SELECTION_STORAGE_KEY, val);
        setImageNodes();
    });

    const appendSelect = () => {
        let timeout = setTimeout(appendSelect, 100);
        const navBtns = document.querySelector('.navbar-buttons');
        if (navBtns) {
            navBtns.prepend(select);
            clearTimeout(timeout);
        }
    };
    appendSelect();
};

const confirmRefreshDb = async () => {
    if (confirm('Refresh local storage images DB?')) {
        await refreshDb();
        window.location.reload();
    }
};