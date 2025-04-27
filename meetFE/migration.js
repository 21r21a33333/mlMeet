const PocketBase = require('pocketbase/cjs');

const pb = new PocketBase('http://127.0.0.1:8090');

async function createCollections() {
  try {
    // First create the recordings collection
    const recordingsCollection = await pb.collections.create({
      name: 'recordings',
      type: 'base',
      schema: [
        {
          name: 'roomName',
          type: 'text',
          required: true
        },
        {
          name: 'participantName',
          type: 'text',
          required: true
        }
      ]
    });
    console.log('Recordings collection created');

    // Then create the chunks collection with relation to recordings
    const chunksCollection = await pb.collections.create({
      name: 'chunks',
      type: 'base',
      schema: [
        {
          name: 'recording',
          type: 'relation',
          required: true,
          options: {
            collectionId: recordingsCollection.id,
            maxSelect: 1
          }
        },
        {
          name: 'data',
          type: 'file',
          required: true,
          options: {
            maxSelect: 1,
            maxSize: 5242880000000000000000000000, // 5MB
            mimeTypes: ['video/webm']
          }
        },
        {
          name: 'order',
          type: 'number',
          required: true,
          options: {
            min: 1
          }
        }
      ]
    });
    console.log('Chunks collection created');

    // // Now update recordings to include chunks relation
    // await pb.collections.update(recordingsCollection.id, {
    //   schema: [
    //     ...recordingsCollection.schema,
    //     {
    //       name: 'chunks',
    //       type: 'relation',
    //       required: false,
    //       options: {
    //         collectionId: chunksCollection.id,
    //         maxSelect: null // Unlimited relations
    //       }
    //     }
    //   ]
    // });
    console.log('Updated recordings collection with chunks relation');

    console.log('All collections created successfully!');
  } catch (err) {
    console.error('Detailed error:', {
      message: err.message,
      status: err.status,
      data: err.data,
      stack: err.stack
    });
  } finally {
    process.exit();
  }
}

// Run as admin
pb.admins.authWithPassword('void.00.diwakar@gmail.com', '21r21a3333')
  .then(() => createCollections())
  .catch(err => {
    console.error('Authentication failed:', err);
    process.exit(1);
  });