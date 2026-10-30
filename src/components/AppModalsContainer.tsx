import React from 'react';
import { MatchFixture } from '../types';
import { AdminLicenseModal } from './AdminLicenseModal';
import { SimulatorModal } from './SimulatorModal';
import { MatchDetailModal, DetailMatchPayload } from './MatchDetailModal';
import { WallpaperSelectorModal } from './WallpaperSelectorModal';
import { DidacticGuideModal, GuideModalTab } from './DidacticGuideModal';
import { SavedSlipsHistoryModal } from './SavedSlipsHistoryModal';
import { ParlayBuilderDrawer } from './ParlayBuilderDrawer';

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
    <>
      {/* Persistent Admin License Modal (shared across lock screen & unlocked dashboard) */}
      <AdminLicenseModal
        isOpen={isAdminModalOpen}
        onClose={onCloseAdminModal}
        onLogout={onLogoutSession}
        onLicenseChanged={onLicenseChanged}
        fixtures={fixtures}
      />

      {/* Interactive Simulator Modal */}
      <SimulatorModal
        isOpen={isSimulatorOpen}
        onClose={onCloseSimulator}
        initialFixture={selectedMatchForSimulator}
      />

      {/* Focused Match Detail Modal (Bottom Sheet on Mobile / Glass Terminal on Desktop) */}
      <MatchDetailModal
        isOpen={Boolean(detailModalPayload)}
        payload={detailModalPayload}
        onClose={onCloseDetailModal}
        isSelected={detailModalPayload ? selectedFixtureIds.has(detailModalPayload.fixture.id) : false}
        onToggleSelect={onToggleSelect}
        onOpenSimulator={onOpenSimulator}
      />

      {/* Cinematic Wallpaper Customizer Modal */}
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

      {/* Beginner Didactic Guide, Technical Glossary & Legal Notice Modal */}
      <DidacticGuideModal
        isOpen={isGuideOpen}
        onClose={onCloseGuideModal}
        initialTab={guideInitialTab}
      />

      {/* Saved Parlay Slips History Modal */}
      <SavedSlipsHistoryModal
        isOpen={isSavedSlipsOpen}
        onClose={onCloseSavedSlipsModal}
      />

      {/* Floating Parlay Builder Drawer & Action Pill */}
      <ParlayBuilderDrawer onOpenHistory={onOpenSavedSlipsModal} />
    </>
  );
};
