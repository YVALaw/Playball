-- build-aseprite.lua
-- Assembles the generated PNG parts into one layered .aseprite document.
--
-- Every part is already registered on the same 128x128 head geometry, so each
-- one drops onto its own layer at 0,0 with no nudging. Toggle layer visibility
-- to comp a face; the layer order below is the order that composites correctly.
--
-- Requires a licensed Aseprite: the trial build ships with --script disabled and
-- cannot save, so this will not run there.
--
--   Aseprite.exe -b --script-param dir=<abs path to design/avatar-kit> \
--                   --script design/avatar-kit/build-aseprite.lua

local dir = app.params["dir"]
if not dir or dir == "" then
  dir = app.fs.filePath(app.fs.normalizePath(debug.getinfo(1, "S").source:sub(2)))
end

local SIZE = 128

-- Bottom to top. A hat must land over the hair it flattens, and facial hair must
-- land over the mouth it covers, so this order is not cosmetic.
local GROUPS = {
  { name = "jersey",      folder = "jerseys",     suffix = "-shoulders" },
  { name = "hair-back",   folder = "hair-hat",    suffix = "-under" },
  { name = "hair",        folder = "hair",        suffix = "-alone" },
  { name = "eyes",        folder = "eyes",        prefix = "style-" },
  { name = "facial-hair", folder = "facial-hair" },
  { name = "hat",         folder = "hats" },
}

local function listPngs(folder, prefix, suffix)
  local out = {}
  for _, f in ipairs(app.fs.listFiles(app.fs.joinPath(dir, "parts", folder))) do
    if f:match("%.png$") then
      local base = f:gsub("%.png$", "")
      local ok = true
      if prefix and not base:find("^" .. prefix) then ok = false end
      if suffix and not base:find(suffix .. "$") then ok = false end
      -- Without an explicit suffix, skip the variants that carry one.
      if not suffix and (base:find("%-alone$") or base:find("%-under$")
                         or base:find("%-shoulders$")) then ok = false end
      if not prefix and folder == "eyes" and base:find("^style%-") then ok = false end
      if ok then table.insert(out, f) end
    end
  end
  table.sort(out)
  return out
end

local sprite = Sprite(SIZE, SIZE, ColorMode.RGB)
sprite:deleteLayer(sprite.layers[1])

local total = 0
for _, g in ipairs(GROUPS) do
  local files = listPngs(g.folder, g.prefix, g.suffix)
  if #files > 0 then
    local group = sprite:newGroup()
    group.name = g.name
    for _, f in ipairs(files) do
      local path = app.fs.joinPath(dir, "parts", g.folder, f)
      local img = Image{ fromFile = path }
      if img then
        local layer = sprite:newLayer()
        layer.name = f:gsub("%.png$", "")
        layer.parent = group
        layer.isVisible = false
        sprite:newCel(layer, 1, img, Point(0, 0))
        total = total + 1
      end
    end
    -- Show one of each group so the document opens on a composed face.
    if #group.layers > 0 then group.layers[1].isVisible = true end
  end
end

sprite.filename = app.fs.joinPath(dir, "avatar-kit.aseprite")
sprite:saveAs(sprite.filename)
print(string.format("built %s with %d layers", sprite.filename, total))
