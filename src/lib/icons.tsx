/**
 * Single source of truth for icons across the app. We use Phosphor (regular
 * weight) for a slightly more elegant feel than Lucide. Each export keeps the
 * familiar Lucide name to avoid renaming hundreds of callsites.
 *
 * IMPORTANT: we import from `@phosphor-icons/react/ssr/<Icon>` (the SSR-safe
 * subpath) instead of the package root, because the root entry initialises
 * React Context at module load — which breaks Server Components.
 */
import { ArrowDown as PArrowDown } from "@phosphor-icons/react/dist/ssr/ArrowDown";
import { ArrowDownRight as PArrowDownRight } from "@phosphor-icons/react/dist/ssr/ArrowDownRight";
import { ArrowLeft as PArrowLeft } from "@phosphor-icons/react/dist/ssr/ArrowLeft";
import { ArrowUp as PArrowUp } from "@phosphor-icons/react/dist/ssr/ArrowUp";
import { ArrowUpRight as PArrowUpRight } from "@phosphor-icons/react/dist/ssr/ArrowUpRight";
import { ArrowsDownUp as PArrowsDownUp } from "@phosphor-icons/react/dist/ssr/ArrowsDownUp";
import { ArrowsClockwise as PArrowsClockwise } from "@phosphor-icons/react/dist/ssr/ArrowsClockwise";
import { ArrowCounterClockwise as PArrowCounterClockwise } from "@phosphor-icons/react/dist/ssr/ArrowCounterClockwise";
import { Buildings as PBuildings } from "@phosphor-icons/react/dist/ssr/Buildings";
import { Check as PCheck } from "@phosphor-icons/react/dist/ssr/Check";
import { CaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr/CaretLeft";
import { CaretRight } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { CaretUp } from "@phosphor-icons/react/dist/ssr/CaretUp";
import { Circle as PCircle } from "@phosphor-icons/react/dist/ssr/Circle";
import { Cloud as PCloud } from "@phosphor-icons/react/dist/ssr/Cloud";
import { DeviceMobile as PDeviceMobile } from "@phosphor-icons/react/dist/ssr/DeviceMobile";
import { DownloadSimple as PDownloadSimple } from "@phosphor-icons/react/dist/ssr/DownloadSimple";
import { Eye as PEye } from "@phosphor-icons/react/dist/ssr/Eye";
import { EyeSlash as PEyeSlash } from "@phosphor-icons/react/dist/ssr/EyeSlash";
import { FileXls } from "@phosphor-icons/react/dist/ssr/FileXls";
import { FileText as PFileText } from "@phosphor-icons/react/dist/ssr/FileText";
import { FunnelSimple } from "@phosphor-icons/react/dist/ssr/FunnelSimple";
import { Fingerprint as PFingerprint } from "@phosphor-icons/react/dist/ssr/Fingerprint";
import { Gear } from "@phosphor-icons/react/dist/ssr/Gear";
import { Laptop as PLaptop } from "@phosphor-icons/react/dist/ssr/Laptop";
import { List as PList } from "@phosphor-icons/react/dist/ssr/List";
import { Lock as PLock } from "@phosphor-icons/react/dist/ssr/Lock";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import { Moon as PMoon } from "@phosphor-icons/react/dist/ssr/Moon";
import { PaperPlaneTilt } from "@phosphor-icons/react/dist/ssr/PaperPlaneTilt";
import { PencilSimple } from "@phosphor-icons/react/dist/ssr/PencilSimple";
import { Plus as PPlus } from "@phosphor-icons/react/dist/ssr/Plus";
import { Receipt as PReceipt } from "@phosphor-icons/react/dist/ssr/Receipt";
import { SignOut } from "@phosphor-icons/react/dist/ssr/SignOut";
import { SquaresFour } from "@phosphor-icons/react/dist/ssr/SquaresFour";
import { Sun as PSun } from "@phosphor-icons/react/dist/ssr/Sun";
import { Trash as PTrash } from "@phosphor-icons/react/dist/ssr/Trash";
import { TrendUp as PTrendUp } from "@phosphor-icons/react/dist/ssr/TrendUp";
import { UploadSimple } from "@phosphor-icons/react/dist/ssr/UploadSimple";
import { Wallet as PWallet } from "@phosphor-icons/react/dist/ssr/Wallet";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr/WarningCircle";
import { CircleNotch } from "@phosphor-icons/react/dist/ssr/CircleNotch";
import { Clock as PClock } from "@phosphor-icons/react/dist/ssr/Clock";
import { X as PX } from "@phosphor-icons/react/dist/ssr/X";
import { Broom as PBroom } from "@phosphor-icons/react/dist/ssr/Broom";
import { ShoppingCartSimple } from "@phosphor-icons/react/dist/ssr/ShoppingCartSimple";
import { Sparkle as PSparkle } from "@phosphor-icons/react/dist/ssr/Sparkle";
import { CheckCircle as PCheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { ArrowsLeftRight as PArrowsLeftRight } from "@phosphor-icons/react/dist/ssr/ArrowsLeftRight";
import { Heart as PHeart } from "@phosphor-icons/react/dist/ssr/Heart";
import { Camera as PCamera } from "@phosphor-icons/react/dist/ssr/Camera";
import { Bell as PBell } from "@phosphor-icons/react/dist/ssr/Bell";
import { BellSlash as PBellSlash } from "@phosphor-icons/react/dist/ssr/BellSlash";

// Re-exports — keep Lucide names so existing callsites work. Phosphor's
// default `regular` weight is close to Lucide's stroke; no wrapper needed.

export const ArrowDown = PArrowDown;
export const ArrowDownRight = PArrowDownRight;
export const ArrowLeft = PArrowLeft;
export const ArrowUp = PArrowUp;
export const ArrowUpRight = PArrowUpRight;
export const ArrowUpDown = PArrowsDownUp;
export const Building2 = PBuildings;
export const Check = PCheck;
export const ChevronDown = CaretDown;
export const ChevronLeft = CaretLeft;
export const ChevronRight = CaretRight;
export const ChevronUp = CaretUp;
export const Circle = PCircle;
export const Cloud = PCloud;
export const Download = PDownloadSimple;
export const Eye = PEye;
export const EyeOff = PEyeSlash;
export const FileSpreadsheet = FileXls;
export const FileText = PFileText;
export const Filter = FunnelSimple;
export const Fingerprint = PFingerprint;
export const Laptop = PLaptop;
export const LayoutDashboard = SquaresFour;
export const Loader2 = CircleNotch;
export const Clock = PClock;
export const Lock = PLock;
export const LogOut = SignOut;
export const Menu = PList;
export const Monitor = PDeviceMobile;
export const Moon = PMoon;
export const Pencil = PencilSimple;
export const Plus = PPlus;
export const Receipt = PReceipt;
export const RefreshCw = PArrowsClockwise;
export const RotateCcw = PArrowCounterClockwise;
export const Search = MagnifyingGlass;
export const Send = PaperPlaneTilt;
export const Settings = Gear;
export const Smartphone = PDeviceMobile;
export const Sun = PSun;
export const Trash2 = PTrash;
export const TrendingUp = PTrendUp;
export const Upload = UploadSimple;
export const Wallet = PWallet;
export const AlertCircle = WarningCircle;
export { WarningCircle };
export const X = PX;
export const Broom = PBroom;
export const ShoppingCart = ShoppingCartSimple;
export const Sparkle = PSparkle;
export const CheckCircle = PCheckCircle;
export const ArrowsLeftRight = PArrowsLeftRight;
export const Heart = PHeart;
export const Camera = PCamera;
export const Bell = PBell;
export const BellSlash = PBellSlash;
