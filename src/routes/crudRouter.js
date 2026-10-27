const express = require('express');

// Builds standard CRUD routes for a model.
// options.filters: query params that map directly to fields (e.g. ['status', 'purok'])
// options.sort: default sort for the list route
function crudRouter(Model, { filters = [], sort = { createdAt: -1 }, label = Model.modelName } = {}) {
  const router = express.Router();
  const notFound = (res) => res.status(404).json({ error: `${label} not found` });

  router.post('/', async (req, res) => {
    res.status(201).json(await Model.create(req.body));
  });

  router.get('/', async (req, res) => {
    const filter = {};
    for (const k of filters) if (req.query[k]) filter[k] = req.query[k];
    res.json(await Model.find(filter).sort(sort));
  });

  router.get('/:id', async (req, res) => {
    const doc = await Model.findById(req.params.id);
    doc ? res.json(doc) : notFound(res);
  });

  // Uses save() rather than findByIdAndUpdate so schema hooks and validators run.
  router.put('/:id', async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) return notFound(res);
    const { _id, createdAt, updatedAt, ...changes } = req.body;
    doc.set(changes);
    res.json(await doc.save());
  });

  router.delete('/:id', async (req, res) => {
    const doc = await Model.findByIdAndDelete(req.params.id);
    doc ? res.status(204).end() : notFound(res);
  });

  return router;
}

module.exports = crudRouter;
