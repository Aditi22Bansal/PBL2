from abc import ABC, abstractmethod
from typing import List, Optional
from domain.schemas import User, StudentProfile, RoomAllocation, AllocationRun

class DataRepository(ABC):
    @abstractmethod
    def get_user(self, email: str) -> Optional[User]:
        pass

    @abstractmethod
    def save_user(self, user: User):
        pass

    @abstractmethod
    def get_student_profile(self, user_id: str) -> Optional[StudentProfile]:
        pass

    @abstractmethod
    def save_student_profile(self, profile: StudentProfile):
        pass

    @abstractmethod
    def get_all_profiles(self) -> List[StudentProfile]:
        pass

    @abstractmethod
    def get_profiles_by_gender(self, gender: str) -> List[StudentProfile]:
        pass

    @abstractmethod
    def save_allocation_run(self, run: AllocationRun):
        pass

    @abstractmethod
    def save_room_allocations(self, allocations: List[RoomAllocation]):
        pass

    @abstractmethod
    def save_unassigned_students(self, run_id: str, unassigned_ids: List[str]):
        pass
    
    @abstractmethod
    def get_room_allocation_for_user(self, user_id: str) -> Optional[RoomAllocation]:
        pass
