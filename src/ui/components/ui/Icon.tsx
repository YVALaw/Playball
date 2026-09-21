// Icon.tsx
// The design system's icons: Radix Icons (the set the app already ships), by
// name. One name means one thing everywhere — see the design system README,
// "Iconography": a lock is always "needs something first", a timer is always
// "running", a clock is always "waiting on the calendar".

import {
  ActivityLogIcon, ArchiveIcon, ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon, ArrowUpIcon,
  BackpackIcon, BarChartIcon, BellIcon, BookmarkIcon, CalendarIcon, CaretSortIcon, ChatBubbleIcon,
  CheckCircledIcon, CheckIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon,
  CountdownTimerIcon, Cross2Icon, CrossCircledIcon, Crosshair2Icon, DotFilledIcon,
  DotsHorizontalIcon, DownloadIcon, DragHandleDots2Icon, EnterIcon, EnvelopeClosedIcon,
  ExclamationTriangleIcon, ExitIcon, EyeOpenIcon, FileTextIcon, FontSizeIcon, GearIcon,
  GlobeIcon, HeartIcon, HomeIcon, IdCardIcon, InfoCircledIcon, LayersIcon, LightningBoltIcon,
  LockClosedIcon, LockOpen1Icon, MagicWandIcon, MagnifyingGlassIcon, MinusCircledIcon, MinusIcon,
  MixerHorizontalIcon, MobileIcon, MoonIcon, PauseIcon, Pencil1Icon, PersonIcon, PlayIcon,
  PlusCircledIcon, PlusIcon, QuestionMarkCircledIcon, ReaderIcon, ResetIcon, RowsIcon,
  ShuffleIcon, SpeakerLoudIcon, StarFilledIcon, StarIcon, StopwatchIcon, SunIcon, TableIcon,
  TargetIcon, TrashIcon, UpdateIcon,
} from '@radix-ui/react-icons';

/** Every Radix icon shares one component type. */
type RadixIcon = typeof ChevronRightIcon;

const ICONS = {
  'chevron-right': ChevronRightIcon,
  'chevron-left': ChevronLeftIcon,
  'chevron-down': ChevronDownIcon,
  'arrow-left': ArrowLeftIcon,
  'arrow-right': ArrowRightIcon,
  'arrow-up': ArrowUpIcon,
  'arrow-down': ArrowDownIcon,
  person: PersonIcon,
  home: HomeIcon,
  globe: GlobeIcon,
  'bar-chart': BarChartIcon,
  lock: LockClosedIcon,
  'lock-open': LockOpen1Icon,
  check: CheckIcon,
  'check-circled': CheckCircledIcon,
  cross: Cross2Icon,
  'cross-circled': CrossCircledIcon,
  clock: ClockIcon,
  timer: CountdownTimerIcon,
  stopwatch: StopwatchIcon,
  alert: ExclamationTriangleIcon,
  info: InfoCircledIcon,
  question: QuestionMarkCircledIcon,
  plus: PlusIcon,
  minus: MinusIcon,
  'plus-circled': PlusCircledIcon,
  'minus-circled': MinusCircledIcon,
  star: StarIcon,
  'star-filled': StarFilledIcon,
  pause: PauseIcon,
  play: PlayIcon,
  target: TargetIcon,
  crosshair: Crosshair2Icon,
  calendar: CalendarIcon,
  reader: ReaderIcon,
  file: FileTextIcon,
  lightning: LightningBoltIcon,
  dot: DotFilledIcon,
  dots: DotsHorizontalIcon,
  drag: DragHandleDots2Icon,
  backpack: BackpackIcon,
  'id-card': IdCardIcon,
  eye: EyeOpenIcon,
  search: MagnifyingGlassIcon,
  filter: MixerHorizontalIcon,
  sort: CaretSortIcon,
  bell: BellIcon,
  gear: GearIcon,
  envelope: EnvelopeClosedIcon,
  chat: ChatBubbleIcon,
  wand: MagicWandIcon,
  sun: SunIcon,
  moon: MoonIcon,
  speaker: SpeakerLoudIcon,
  trash: TrashIcon,
  download: DownloadIcon,
  heart: HeartIcon,
  activity: ActivityLogIcon,
  shuffle: ShuffleIcon,
  swap: UpdateIcon,
  reset: ResetIcon,
  'text-size': FontSizeIcon,
  exit: ExitIcon,
  enter: EnterIcon,
  bookmark: BookmarkIcon,
  mobile: MobileIcon,
  layers: LayersIcon,
  rows: RowsIcon,
  table: TableIcon,
  pencil: Pencil1Icon,
  archive: ArchiveIcon,
} satisfies Record<string, RadixIcon>;

export type IconName = keyof typeof ICONS;

export interface IconProps {
  name: IconName;
  size?: number;
  /** Makes the icon meaningful to a screen reader. Decorative without it. */
  label?: string;
  className?: string;
}

export function Icon({ name, size = 16, label, className }: IconProps) {
  const Glyph: RadixIcon = ICONS[name];
  return (
    <Glyph
      width={size}
      height={size}
      className={className ? `pb-icon ${className}` : 'pb-icon'}
      focusable="false"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
