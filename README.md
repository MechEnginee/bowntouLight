<div align="center">
  <img src="./assets/logo.png" alt="BOWNTOU WORSHIP" width="480" />
</div>

# Worship Lighting Sim

> A 3D lighting simulator for **BOWNTOU WORSHIP** at Saemoonan Church

A web-based 3D lighting simulator built to **pre-validate the lighting environment
and rehearse lighting** for the BOWNTOU WORSHIP service at Saemoonan Church,
Seoul, Republic of Korea.

<br />

## ✨ About BOWNTOU WORSHIP

Launched in October 2024, BOWNTOU WORSHIP is a worship community being raised up
as a place of **deeper worship for Korea's teenagers and young adults**.

> Remembering that we were created to worship God (**Born to**),
> we become those who cry out like John the Baptist in the heart of Gwanghwamun,
> a wilderness of our time (**Bowntou**),
> a worship community preparing the way of the Lord.

**Our Mission**

1. To offer true worship that gives glory to God.
2. To proclaim the gospel through worship, inside and outside the church.

<br />

## 📍 Worship Info

| | |
|---|---|
| **Venue** | Underwood Hall, B2, Saemoonan Church, Gwanghwamun, Seoul |
| **When** | The **2nd Friday** of every month |

<br />

## 💡 What Light Means to Us

Worship is a **whole-person act**. Human beings stand before God not as souls only,
but as beings with bodies and senses. As seen in the structure of the tabernacle and
temple and in the architecture of medieval cathedrals, **light, space, and sound have
always carried theological meaning** within worship.

The environment never replaces the essence. The center of worship is always **God and
His Word**. Yet so that this center is clearly conveyed, lighting and sound serve as
**responsible tools** that help to:

- strengthen the delivery of the Word and praise,
- draw our eyes to the center of worship,
- reduce distraction and invite the community's participation,
- help us fix our gaze on God.

Lighting is not a device for performance, and sound is not a tool for setting a mood.
Their purpose is to **order the environment so that worshippers may focus on God more
clearly and deeply**. Lighting and sound are not the master of worship, but they help
reveal its center.

<br />

## 🤝 Using This Source

**Anyone who seeks to help a congregation meet God in the place of worship with all
their senses is free to use this source.**

<br />

---

<br />

<div align="center">
  <img src="./assets/logo.png" alt="BOWNTOU WORSHIP" width="480" />
</div>

# 워십 조명 시뮬레이터

> 새문안교회 **본투워십(BOWNTOU WORSHIP)** 예배를 위한 3D 조명 시뮬레이터

대한민국 서울 새문안교회 본투워십 예배의 **조명 환경을 사전 검증하고 조명 연습**을
하기 위해 만들어진 웹 기반 3D 조명 시뮬레이터입니다.

<br />

## ✨ 본투워십 (BOWNTOU WORSHIP)

본투워십은 2024년 10월부터 시작되어, 한국의 **청소년·청년 세대**를 위한
더 깊은 예배의 자리로 세워져 가고 있는 예배 공동체입니다.

> 본회는 본래 하나님을 예배하기 위하여 지음 받은 자들임을 기억하며(**Born to**),
> 광야와도 같은 광화문 한복판에서 세례 요한과 같이 외치는 자들이 되어(**Bowntou**)
> 주의 길을 준비하는 예배 공동체가 되는 것을 목적으로 합니다.

**우리의 사명**

1. 하나님께 영광 돌리는 참된 예배를 드린다.
2. 교회 안과 밖에서 예배를 통해 복음을 선포한다.

<br />

## 📍 예배 안내

| | |
|---|---|
| **장소** | 서울 광화문 새문안교회 **지하 2층 언더우드홀** |
| **일시** | 매달 **둘째 주 금요일** |

<br />

## 💡 우리가 생각하는 조명의 의미

예배는 **전인적 행위**입니다. 인간은 영혼만이 아니라 몸과 감각을 가진 존재로
하나님 앞에 섭니다. 성막과 성전의 구조, 중세 성당 건축과 오르간의 도입에서 보듯,
**빛과 공간과 소리는 언제나 예배 안에서 신학적 의미**를 지녀 왔습니다.

환경은 본질을 대신하지 않습니다. 예배의 중심은 언제나 **하나님과 말씀**에 있습니다.
다만 그 중심이 분명히 전달되도록, 조명과 음향은 아래를 돕는 **책임 있는 도구**입니다.

- 말씀과 찬양의 **전달력**을 높이는 것
- 시선을 **예배의 중심**으로 모으는 것
- 산만함을 줄여 **공동체적 참여**를 돕는 것
- **하나님을 바라보는 데** 도움을 주는 것

조명은 공연을 위한 장치가 아니며, 음향은 분위기 연출을 위한 도구가 아닙니다.
그 목적은 예배자가 하나님께 **더 분명히, 더 깊이 집중하도록 환경을 정돈**하는 데 있습니다.
조명과 음향은 예배의 주인이 아니지만, 예배의 중심을 분명히 드러내도록 돕습니다.

<br />

## 🤝 소스 사용 안내

**누구든지 예배의 회중이 온 감각으로 예배의 자리에서 하나님을 만나도록 돕고자 하는
분들은 이 소스를 자유롭게 사용하셔도 됩니다.**

<br />

## 🛠 실행 및 배포 (Getting Started)

```bash
yarn install
yarn dev      # 개발 서버 / dev server
yarn build    # 프로덕션 빌드 → dist/
yarn preview  # 빌드 결과 미리보기
```

`main` 브랜치에 푸시하면 GitHub Actions가 자동으로 GitHub Pages에 배포합니다.
Pushing to `main` auto-deploys to GitHub Pages via GitHub Actions.

배포 주소 / Deploy URL: `https://mechenginee.github.io/bowntouLight/`

> GitHub Pages 서브패스 배포를 위해 `vite.config.ts` 의 `base` 가 `/bowntouLight/` 로
> 설정되어 있습니다. 커스텀 도메인이나 루트(`/`) 배포로 옮길 땐 `base` 를 `'/'` 로 바꾸면 됩니다.
