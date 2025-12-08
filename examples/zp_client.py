import os
import re
from time import sleep
from typing import Literal

import httpx
import logfire
from bs4 import BeautifulSoup


class ZPClient:
    """Other APIs to add:
    team_riders=f"{self.zp_url}/api3.php?do=team_riders&id={id}",
    team_pending=f"{self.zp_url}/api3.php?do=team_pending&id={id}",
    team_results=f"{self.zp_url}/api3.php?do=team_results&id={id}",
    profile_profile=f"{self.zp_url}/cache3/profile/{id}_all.json",
    live_results=f"{self.zp_url}/api3.php?do=live_results&id={id}",
    """

    def __init__(self):
        """Init for class.
        login dictionary is a dict of {"username":"YOUR USERNAME", "password":YOUR PASSWORD"}
        """
        self.login_data = {"username": os.getenv("ZWIFTPOWER_USERNAME"), "password": os.getenv("ZWIFTPOWER_PASSWORD")}
        self.zp_url = "https://zwiftpower.com"
        self.zp_events_url = "https://zwiftpower.com/events.php"
        self.session = None
        # User Agent required or will be blocked at some apis
        self.user_agent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"

    def check_status(self) -> bool:
        """Check if the session is valid."""
        try:
            if self.session is None:
                return False
            else:
                r = self.session.get(self.zp_url)
                r.raise_for_status()
                login_required = "Login Required" in r.text
                logfire.info(f"Status: {r.status_code} Login Required: {login_required}")
                sleep(1)
                r = self.session.get(self.zp_events_url)
                status_code = r.status_code == 200
                return bool(status_code and not login_required)
        except Exception as e:
            logfire.error(f"Failed to check status:\n{e}")
            return False

    def login(self) -> Literal["Success", "Error"]:
        """Login to ZP and get session."""
        s = httpx.Client()
        self.login_data.update({"rememberMe": "on"})
        logfire.info(f"Login Data: {self.login_data}")
        s.headers.update({"User-Agent": self.user_agent})
        resp = s.get("https://zwiftpower.com/")
        logfire.info(f"Init login status: {resp.status_code}")
        r2 = s.get(
            "https://zwiftpower.com/ucp.php?mode=login&login=external&oauth_service=oauthzpsso", follow_redirects=True
        )
        soup = BeautifulSoup(r2.text, "html.parser")
        # logfire.info(soup.find("form"))

        post_url = soup.find("form")["action"]
        logfire.info(post_url)

        logfire.info(f"Post URL: {post_url}")
        r3 = s.post(post_url, data=self.login_data, follow_redirects=True)
        logfire.info(f"Post LOGIN URL: {r3.status_code}")
        try:  # make sure we are logged in
            logfire.info(f"https://secure.zwift.com: {'https://secure.zwift.com/' not in str(r3.url)}")
            logfire.info(f"https://zwiftpower.com/events.php: {'https://zwiftpower.com/events.php' in str(r3.url)}")
            logfire.info(f"invalid username or password.: {'invalid username or password.' in r3.text.lower()}")
            assert "https://secure.zwift.com/" not in str(r3.url)
            assert "https://zwiftpower.com/events.php" in str(r3.url)
            assert "invalid username or password." not in r3.text.lower()
        except Exception as e:
            logfire.error(f"Failed to login to ZP(1):\n{e!s}")
            self.session = None
            return "Error"
        logfire.info("Logged in session created")
        self.session = s
        return "Success"

    def init_client(self) -> httpx.Client | None:
        """Get session if valid, else login and get session."""
        with logfire.span("ZPClient:init_client"):
            if self.check_status():
                logfire.info("Session is valid")
                return self.session
            else:
                logfire.info("Session is not valid")
                try:
                    self.login()
                    return self.session
                except Exception as e:
                    logfire.error(f"Failed to login to ZP and get session:\n{e}")
                    return None


def get_promoter_events(promotor: str = "FRR") -> dict:
    """Zwift Promoter events.

    Example data:
    - 'tests/zwift/example_data/series_event_list_promotor_events.json'
    """
    zpc = ZPClient()
    client = zpc.init_client()
    client.get(f"https://zwiftpower.com/api3.php?do=series_event_list&id={promotor}")


def view_data(self):
    zpc = ZPClient()
    client = zpc.init_client()
    return client.get(f"https://zwiftpower.com/cache3/results/{self.zid}_view.json")


def get_live_events(zid: int) -> dict:
    """ZP live event data."""
    zpc = ZPClient()
    client = zpc.init_client()
    client.get(f"https://zwiftpower.com/api3.php?do=live_results&id={zid}")


def get_profile_html_data(zwid: int) -> dict:
    """ZP profile html data.

    Parse the html getting these values and returning as a dict.
    - ProfileName: mads hedelund [DBR]
    - RaceRankingPts: 220.49
    - RaceRankingPlace: 5477
    - ZwiftRacingScore: 649
    - ZPoints: 7875
    - ZPointsPlace: 2001
    - Country: Denmark

    :returns: dict with profile data
    """
    zpc = ZPClient()
    client = zpc.init_client()
    response = client.get(f"https://zwiftpower.com/profile.php?z={zwid}")

    soup = BeautifulSoup(response.text, "html.parser")

    # Initialize result dictionary
    result = {
        "ZpName": None,
        "RaceRankingPts": None,
        "RaceRankingPlace": None,
        "ZwiftRacingScore": None,
        "ZPoints": None,
        "ZPointsPlace": None,
        "Country": None,
    }

    # Extract profile name from tab link
    profile_name_link = soup.find("a", {"href": "#tab-results", "data-toggle": "tab"})
    if profile_name_link:
        result["ProfileName"] = profile_name_link.get_text(strip=True)

    # Find the profile information table
    profile_table = soup.find("table", {"id": "profile_information"})
    if not profile_table:
        return result

    # Parse Race Ranking (e.g., "220.49 pts in 5,477th")
    for row in profile_table.find_all("tr"):
        th = row.find("th")
        if th and "Race Ranking" in th.get_text():
            td = row.find("td")
            if td:
                text = td.get_text(strip=True)
                # Extract pts and place from text like "220.49 pts in 5,477th"
                pts_match = re.search(r"([\d,]+\.?\d*)\s*pts", text)
                place_match = re.search(r"in\s*([\d,]+)", text)
                if pts_match:
                    result["RaceRankingPts"] = float(pts_match.group(1).replace(",", ""))
                if place_match:
                    result["RaceRankingPlace"] = int(place_match.group(1).replace(",", ""))

    # Parse Zwift Racing Score (e.g., "649")
    for row in profile_table.find_all("tr"):
        th = row.find("th")
        if th and "Zwift Racing Score" in th.get_text():
            td = row.find("td")
            if td:
                b_tag = td.find("b")
                if b_tag:
                    result["ZwiftRacingScore"] = int(b_tag.get_text(strip=True))

    # Parse ZPoints (e.g., "7,875 pts in 2001st")
    for row in profile_table.find_all("tr"):
        th = row.find("th")
        if th and "ZPoints" in th.get_text():
            td = row.find("td")
            if td:
                text = td.get_text(strip=True)
                pts_match = re.search(r"([\d,]+)\s*pts", text)
                place_match = re.search(r"in\s*([\d,]+)", text)
                if pts_match:
                    result["ZPoints"] = int(pts_match.group(1).replace(",", ""))
                if place_match:
                    result["ZPointsPlace"] = int(place_match.group(1).replace(",", ""))

    # Parse Country (e.g., "Denmark")
    for row in profile_table.find_all("tr"):
        th = row.find("th")
        if th and "Country" in th.get_text():
            td = row.find("td")
            if td:
                result["Country"] = td.get_text(strip=True)

    return result


# class EventAPIs(BaseModel):
# """Zwift Event APIs."""
#
# zid: int
# cat: str = "all"
# prime_opt: str = "msec"
# view: dict = {}
# zwift: dict = {}
# signups: dict = {}
# primes: dict = {}
# sprints: dict = {}
# live_results: dict = {}
#
# @property
# def view_url(self):
#     return f"https://zwiftpower.com/cache3/results/{self.zid}_view.json"
#
# @property
# def zwift_url(self):
#     return f"https://zwiftpower.com/cache3/results/{self.zid}_zwift.json"
#
# @property
# def primes_url(self):
#     cat_opt = f"&category={self.cat}" if self.cat != "all" else ""
#     return f"https://zwiftpower.com/api3.php?do=event_primes&zid={self.zid}{cat_opt}&prime_type={self.prime_opt}"
#
# @property
# def signups_url(self):
#     return f"https://zwiftpower.com/cache3/results/{self.zid}_signups.json"
#
# @property
# def sprints_url(self):
#     return f"https://zwiftpower.com/api3.php?do=event_sprints&zid={self.zid}"
#
# @property
# def live_results_url(self):
#     return f"https://zwiftpower.com/api3.php?do=live_results&id={self.zid}"
#
# def get_all_data(self):
#     """Get all data from ZP API.
#
#     Except live_results
#     """
#     zpc = ZPClient()
#     client = zpc.init_client()
#     for api, url in [
#         (self.view, self.view_url),
#         (self.zwift, self.zwift_url),
#         (self.primes, self.primes_url),
#         (self.signups, self.signups_url),
#         (self.sprints, self.sprints_url),
#     ]:
#         api = client.get(url)
