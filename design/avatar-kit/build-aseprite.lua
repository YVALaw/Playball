-- build-aseprite.lua
-- Turns the sliced reference sheet into one layered .aseprite document.
--
-- Every part from parts/ lands on its own named layer, positioned where it sat
-- on the sheet, inside a group per folder. Flattened, the document is the sheet
-- again; with one layer soloed, it is that part. Each part is also registered
-- as a named Aseprite slice so the sprite-sheet exporter can emit it by name.
--
-- Requires a licensed Aseprite: the trial build ships with --script disabled and
-- cannot save, so this will not run there.
--
--   Aseprite.exe -b --script-param dir=<abs path to design/avatar-kit> ^
--                   --script design/avatar-kit/build-aseprite.lua

local dir = app.params["dir"]
if not dir or dir == "" then
  dir = app.fs.filePath(app.fs.normalizePath(debug.getinfo(1, "S").source:sub(2)))
end

local f = io.open(app.fs.joinPath(dir, "slices.json"), "r")
assert(f, "slices.json not found next to this script; run scripts/slice-reference.mjs first")
local map = json.decode(f:read("a"))
f:close()

local sprite = Sprite(map.width, map.height, ColorMode.RGB)
sprite:deleteLayer(sprite.layers[1])

-- Groups in the order the sheet reads, bottom to top.
local ORDER = { "skin", "eyes", "facial-hair", "hair", "hair-hat", "hats", "jerseys", "avatars" }
local groups = {}
for _, name in ipairs(ORDER) do
  local g = sprite:newGroup()
  g.name = name
  groups[name] = g
end

local n = 0
for _, s in ipairs(map.slices) do
  local path = app.fs.joinPath(dir, "parts", s.folder, s.name .. ".png")
  local img = Image{ fromFile = path }
  if img then
    local layer = sprite:newLayer()
    layer.name = s.name
    layer.parent = groups[s.folder] or sprite
    sprite:newCel(layer, 1, img, Point(s.x, s.y))

    local slice = sprite:newSlice(Rectangle(s.x, s.y, s.w, s.h))
    slice.name = s.folder .. "/" .. s.name
    n = n + 1
  else
    print("missing part: " .. path)
  end
end

sprite.filename = app.fs.joinPath(dir, "avatar-kit.aseprite")
sprite:saveAs(sprite.filename)
print(string.format("built %s: %d parts as layers and slices", sprite.filename, n))
