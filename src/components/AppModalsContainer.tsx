import React, { Suspense } from 'react';
import type { MatchFixture } from '../types';
import type { DetailMatchPayload } from './MatchDetailModal';
import type { GuideModalTab } from './DidacticGuideModal';

const AdminLicenseModal = React.lazy(() => import('./AdminLicenseModal').then(m => ({ default: m.AdminLicenseModal })));
const SimulatorModal = React.lazy(() => import('./SimulatorModal').then(m => ({ default: m.SimulatorModal })));
const MatchDetailModal = React.lazy(() => import('./MatchDetailModal').then(m => ({ default: m.MatchDetailModal })));
const WallpaperSelectorModal = React.lazy(() => import('./WallpaperSelectorModal').then(m => ({ default: m.WallpaperSelectorModal })));
const DidacticGuideModal = React.lazy(() => import('./DidacticGuideModal').then(m => ({ default: m.DidacticGuideModal })));
const SavedSlipsHistoryModal = React.lazy(() => import('./SavedSlipsHistoryModal').then(m => ({ default: m.SavedSlipsHistoryModal })));
const ParlayBuilderDrawer = React.lazy(() => import('./ParlayBuilderDrawer').then(m => ({ default: m.ParlayBuilderDrawer })));

export interface AppModalsContainerProps {
  isAdminModalOpen: boolean;
  onCloseAdminModal: () => void;
  onLogoutSession: () => void;
  onLicenseChanged: () => void;
  fixtures?: MatchFixture[];
  isSimulatorOpen: boolean;
  onCloseSimulator: () => void;
  selectedMatchForSimulator: MatchFixture | null;
  detailModalPayload: DetailMatchPayload | null;
  onCloseDetailModal: () => void;
  selectedFixtureIds: Set<string>;
  onToggleSelect: (fixtureId: string) => void;
  onOpenSimulator: (fixture: MatchFixture) => void;
  isWallpaperModalOpen: boolean;
  onCloseWallpaperModal: () => void;
  selectedWallpaper: string;
  onSelectWallpaper: (url: string) => void;
  wallpaperOpacity: number;
  onChangeOpacity: (val: number) => void;
  wallpaperBlur: number;
  onChangeBlur: (val: number) => void;
  isGuideOpen: boolean;
  onCloseGuideModal: () => void;
  guideInitialTab: GuideModalTab;
  isSavedSlipsOpen: boolean;
  onCloseSavedSlipsModal: () => void;
  onOpenSavedSlipsModal: () => void;
}

export const AppModalsContainer: React.FC<AppModalsContainerProps> = ({
  isAdminModalOpen,
  onCloseAdminModal,
  onLogoutSession,
  onLicenseChanged,
  fixtures = [],
  isSimulatorOpen,
  onCloseSimulator,
  selectedMatchForSimulator,
  detailModalPayload,
  onCloseDetailModal,
  selectedFixtureIds,
  onToggleSelect,
  onOpenSimulator,
  isWallpaperModalOpen,
  onCloseWallpaperModal,
  selectedWallpaper,
  onSelectWallpaper,
  wallpaperOpacity,
  onChangeOpacity,
  wallpaperBlur,
  onChangeBlur,
  isGuideOpen,
  onCloseGuideModal,
  guideInitialTab,
  isSavedSlipsOpen,
  onCloseSavedSlipsModal,
  onOpenSavedSlipsModal
}) => {
  return (
    <Suspense fallback={null}>
      {/* Persistent Admin License Modal (shared across lock screen & unlocked dashboard) */}
      {isAdminModalOpen && (
        <AdminLicenseModal
          isOpen={isAdminModalOpen}
          onClose={onCloseAdminModal}
          onLogout={onLogoutSession}
          onLicenseChanged={onLicenseChanged}
          fixtures={fixtures}
        />
      )}

      {/* Interactive Simulator Modal */}
      {isSimulatorOpen && (
        <SimulatorModal
          isOpen={isSimulatorOpen}
          onClose={onCloseSimulator}
          initialFixture={selectedMatchForSimulator}
        />
      )}

      {/* Focused Match Detail Modal (Bottom Sheet on Mobile / Glass Terminal on Desktop) */}
      {Boolean(detailModalPayload) && (
        <MatchDetailModal
          isOpen={Boolean(detailModalPayload)}
          payload={detailModalPayload}
          onClose={onCloseDetailModal}
          isSelected={detailModalPayload ? selectedFixtureIds.has(detailModalPayload.fixture.id) : false}
          onToggleSelect={onToggleSelect}
          onOpenSimulator={onOpenSimulator}
        />
      )}

      {/* Cinematic Wallpaper Customizer Modal */}
      {isWallpaperModalOpen && (
        <WallpaperSelectorModal
          isOpen={isWallpaperModalOpen}
          onClose={onCloseWallpaperModal}
          currentWallpaperUrl={selectedWallpaper}
          onSelectWallpaper={onSelectWallpaper}
          opacity={wallpaperOpacity}
          onChangeOpacity={onChangeOpacity}
          blur={wallpaperBlur}
          onChangeBlur={onChangeBlur}
        />
      )}

      {/* Beginner Didactic Guide, Technical Glossary & Legal Notice Modal */}
      {isGuideOpen && (
        <DidacticGuideModal
          isOpen={isGuideOpen}
          onClose={onCloseGuideModal}
          initialTab={guideInitialTab}
        />
      )}

      {/* Saved Parlay Slips History Modal */}
      {isSavedSlipsOpen && (
        <SavedSlipsHistoryModal
          isOpen={isSavedSlipsOpen}
          onClose={onCloseSavedSlipsModal}
        />
      )}

      {/* Floating Parlay Builder Drawer & Action Pill */}
      <ParlayBuilderDrawer onOpenHistory={onOpenSavedSlipsModal} />
    </Suspense>
  );
};
