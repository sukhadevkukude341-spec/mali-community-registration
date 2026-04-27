/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'STAFF' | 'USER';

export interface AppUser {
  uid: string;
  email: string;
  fullName: string;
  role: UserRole;
  village?: string;
  password?: string; // Stored in database for manual login system
  isLocked?: boolean;
  forceReset?: boolean;
  createdAt: number;
}

export interface ActivityLog {
  id: string;
  action: string;
  performedBy: string; // UID
  targetUser: string; // UID or Email
  timestamp: number;
  details?: string;
}

export interface AgricultureInfo {
  landAcres: string;
  crops: string;
}

export interface FamilyMember {
  id: string;
  firstName: string;
  middleName: string;
  lastName: string;
  relation: string;
  age: number;
  gender: 'पुरुष' | 'स्त्री' | 'इतर';
  education: string;
  occupation: string;
  mobile: string;
  bloodGroup?: string;
}

export interface Family {
  id: string;
  headName: string;
  mobile: string;
  address: string;
  village: string;
  taluka: string;
  district: string;
  pincode: string;
  agriculture?: AgricultureInfo;
  members: FamilyMember[];
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  photoUrl?: string;
  registeredBy: string; // User UID
  registeredAt: number;
  updatedAt: number;
}

export interface PublicNotice {
  id: string;
  title: string;
  content: string;
  date: number;
  isActive: boolean;
}
