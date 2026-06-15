const express = require('express');
const fs = require('fs');
const path = require('path');
const { listPersonas, getPersona, deletePersona, getCallHistory } = require('../db/database');
const { createPersona } = require('../services/personaService');

const router = express.Router();

// POST /api/personas — Create persona
router.post('/personas', async (req, res) => {
  try {
    const { name, photoPath, audioPath, chatLogs } = req.body;

    if (!photoPath) {
      return res.status(400).json({ success: false, error: '请上传一张照片' });
    }
    if (!chatLogs || chatLogs.trim().length < 10) {
      return res.status(400).json({ success: false, error: '请至少输入10个字的聊天记录或人物描述' });
    }

    console.log(`[Personas] Creating persona "${name || '未命名'}"...`);
    const persona = await createPersona({ name, photoPath, audioPath, chatLogs });

    console.log(`[Personas] Created: ${persona.id} — ${persona.name}`);
    res.json({ success: true, data: persona });
  } catch (err) {
    console.error('[Personas] Create error:', err.message);
    res.status(500).json({ success: false, error: `创建失败: ${err.message}` });
  }
});

// GET /api/personas — List all personas
router.get('/personas', (req, res) => {
  try {
    const personas = listPersonas();
    res.json({ success: true, data: personas });
  } catch (err) {
    console.error('[Personas] List error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/personas/:id — Get persona detail
router.get('/personas/:id', (req, res) => {
  try {
    const persona = getPersona(req.params.id);
    if (!persona) {
      return res.status(404).json({ success: false, error: '数字人不存在' });
    }
    res.json({ success: true, data: persona });
  } catch (err) {
    console.error('[Personas] Get error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/personas/:id — Delete persona
router.delete('/personas/:id', (req, res) => {
  try {
    const persona = deletePersona(req.params.id);
    if (!persona) {
      return res.status(404).json({ success: false, error: '数字人不存在' });
    }

    // Clean up uploaded files
    if (persona.photo_url) {
      const photoPath = path.join(__dirname, '..', persona.photo_url);
      if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
    }
    if (persona.audio_url) {
      const audioPath = path.join(__dirname, '..', persona.audio_url);
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
    }

    console.log(`[Personas] Deleted: ${persona.id}`);
    res.json({ success: true, data: { id: persona.id } });
  } catch (err) {
    console.error('[Personas] Delete error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/personas/:id/calls — Get call history
router.get('/personas/:id/calls', (req, res) => {
  try {
    const persona = getPersona(req.params.id);
    if (!persona) {
      return res.status(404).json({ success: false, error: '数字人不存在' });
    }
    const calls = getCallHistory(req.params.id);
    res.json({ success: true, data: calls });
  } catch (err) {
    console.error('[Personas] Call history error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
